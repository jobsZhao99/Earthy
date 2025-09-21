// src/services/posting.ts
import { PrismaClient, AccountCode } from "@prisma/client";
import { DateTime } from "luxon";
import { DEFAULT_TIMEZONE } from "../src/config.js";
import { toDateOnly } from "../src/utils/dates.js";
const prisma = new PrismaClient();


/** 
 * 按“物业时区”的自然月切分入住-退房区间，返回每段的天数（含入住和退房当日） 
 */
function splitDaysByMonthTZ(checkIn: Date, checkOut: Date) {
  // 注意：这里退房日也算一天
  const ci = DateTime.fromJSDate(checkIn);
  const co = DateTime.fromJSDate(checkOut).plus({ days: 1 });
  // ↑ 把退房日包含进去 → 等价于 nights+1

  if (co <= ci) return [];

  const chunks: { periodMonthUTC: Date; days: number }[] = [];
  let cursor = ci;
  while (cursor < co) {
    const monthStartLocal = cursor.startOf("month");
    const nextMonthLocal = monthStartLocal.plus({ months: 1 });
    const stop = co < nextMonthLocal ? co : nextMonthLocal;
    const days = Math.max(0, Math.round(stop.diff(cursor, "days").days));
    if (days > 0) {
      // 账期：该地月初 → UTC 月初
      const periodMonthUTC = monthStartLocal.toUTC().startOf("month").toJSDate();
      chunks.push({ periodMonthUTC, days });
    }
    cursor = nextMonthLocal;
  }
  return chunks;
}
export async function postBookingAccruals(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { room: { include: { property: true } } }
  });
  if (!booking) throw new Error("Booking not found");

  const ledgerId = booking.room.property.ledgerId;

  // 切分
  const chunks = splitDaysByMonthTZ(booking.checkIn, booking.checkOut);
  const totalDays = chunks.reduce((s, c) => s + c.days, 0);
  if (totalDays === 0) return { posted: 0 };

  const totalCents = booking.payoutCents ?? 0;

  // ⚠️ 先找到（或创建）一个 BookingRecord 作为过账基准
  let bookingRecord = await prisma.bookingRecord.findFirst({
    where: { bookingId: booking.id, type: "NEW" }
  });
  if (!bookingRecord) {
    bookingRecord = await prisma.bookingRecord.create({
      data: {
        bookingId: booking.id,
        type: "NEW",
        guestDeltaCents: booking.guestTotalCents,
        payoutDeltaCents: booking.payoutCents,
        rangeStart: booking.checkIn,
        rangeEnd: booking.checkOut,
      }
    });
  }

  // 分摊写入 JournalLine
  let createdLines = 0;
  let allocatedCents = 0;
  let allocatedDays = 0;
  for (let i = 0; i < chunks.length; i++) {
    const { periodMonthUTC, days } = chunks[i];
    const baseDays = i < chunks.length - 1 ? days : totalDays - allocatedDays;
    const share =
      i < chunks.length - 1
        ? Math.round((totalCents * baseDays) / totalDays)
        : totalCents - allocatedCents;

    allocatedCents += share;
    allocatedDays += baseDays;

    await prisma.$transaction(async (tx) => {
      const journal = await tx.journalEntry.upsert({
        where: { periodMonth_ledgerId: { periodMonth: periodMonthUTC, ledgerId } },
        update: {},
        create: {
          periodMonth: periodMonthUTC,
          ledgerId,
          memo: `Auto posting ${DateTime.fromJSDate(periodMonthUTC).toISODate()}`
        }
      });

      try {
        await tx.journalLine.create({
          data: {
            journalId: journal.id,
            bookingRecordId: bookingRecord.id,  // ✅ 用 bookingRecordId
            account: AccountCode.RENT,
            amountCents: share
          }
        });
        createdLines++;
      } catch (e: any) {
        if (e?.code !== "P2002") throw e;
      }
    });
  }

  return { posted: createdLines, months: chunks.length, totalDays, totalCents };
}
