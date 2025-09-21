import { PrismaClient, AccountCode } from "@prisma/client";
import { DateTime } from "luxon";

const prisma = new PrismaClient();

function daysPerMonth(startJS: Date, endJS?: Date) {
  let start = DateTime.fromJSDate(startJS).toUTC().startOf("day");
  let end = endJS
    ? DateTime.fromJSDate(endJS).plus({ days: 1 }).toUTC().startOf("day")
    : start.plus({ days: 1 });

  if (end <= start) end = start.plus({ days: 1 });

  const map = new Map<string, number>();
  let cursor = start;
  while (cursor < end) {
    const key = cursor.startOf("month").toISODate(); // YYYY-MM-01
    map.set(key, (map.get(key) ?? 0) + 1);
    cursor = cursor.plus({ days: 1 });
  }
  return map;
}

function allocateByDays(total: number, monthDays: Array<{ key: string; days: number }>) {
  if (!Number.isFinite(total) || total === 0 || monthDays.length === 0) {
    return new Map<string, number>();
  }
  const totalDays = monthDays.reduce((s, d) => s + d.days, 0);
  const alloc = new Map<string, number>();
  let allocated = 0;
  for (let i = 0; i < monthDays.length; i++) {
    const { key, days } = monthDays[i];
    if (i < monthDays.length - 1) {
      const share = Math.round((total * days) / totalDays);
      alloc.set(key, share);
      allocated += share;
    } else {
      const remainder = total - allocated;
      alloc.set(key, remainder);
    }
  }
  return alloc;
}

/** 给单条 bookingRecord 生成/更新对应 JournalLines */
export async function postBookingAccruals(recordId: string) {
  const r = await prisma.bookingRecord.findUnique({
    where: { id: recordId },
    include: {
      booking: {
        include: {
          room: { include: { property: { include: { ledger: true } } } },
        },
      },
    },
  });
  if (!r) return;
  const ledger = r.booking?.room?.property?.ledger;
  if (!ledger) return;

  const monthDaysMap = daysPerMonth(r.rangeStart, r.rangeEnd);
  const monthDays = [...monthDaysMap.entries()].map(([key, days]) => ({ key, days }));

  const allocGuest = allocateByDays(r.payoutDeltaCents ?? 0, monthDays);

  for (const { key: monthKey } of monthDays) {
    const periodMonth = DateTime.fromISO(monthKey).startOf("month").toJSDate();
    const journal = await prisma.journalEntry.upsert({
      where: {
        periodMonth_ledgerId: { periodMonth, ledgerId: ledger.id },
      },
      update: {},
      create: {
        periodMonth,
        ledgerId: ledger.id,
        memo: `Auto for ${monthKey}`,
      },
      select: { id: true },
    });

    const rentCents = allocGuest.get(monthKey) ?? 0;
    if (rentCents !== 0) {
      await prisma.journalLine.upsert({
        where: {
          bookingRecordId_account_journalId: {
            bookingRecordId: r.id,
            account: AccountCode.RENT,
            journalId: journal.id,
          },
        },
        update: { amountCents: rentCents },
        create: {
          journalId: journal.id,
          bookingRecordId: r.id,
          account: AccountCode.RENT,
          amountCents: rentCents,
        },
      });
    }
  }
}
