// services/posting.js（节选）
import { splitNightsByMonth, toUTCMonthStart } from "../utils/timezone.js";
import { PrismaClient } from "@prisma/client";
import { DateTime } from "luxon";
import { allocateByDays } from "../utils/allocate.js";

const prisma = new PrismaClient();

async function getPropertyTzByRoomId(roomId) {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: { property: true }
  });
  if (!room) throw new Error("Room not found");
  return room.property.timezone || DEFAULT_TIMEZONE;
}



export async function postBookingAccruals(bookingId) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { room: { include: { property: true } }, lineItems: true }
  });
  if (!booking) throw new Error("Booking not found");
  const propertyTz = booking.tzSnapshot || booking.room.property.timezone || DEFAULT_TIMEZONE;

    // 1) 按物业时区切分跨月晚数
    const chunks = splitNightsByMonth(booking.checkIn, booking.checkOut);
    if (chunks.length === 0) return { posted: 0 };

    // 2) 金额口径
    const payout = booking.payout ?? 0; // 必要字段：没有就视为0

    // 3) 分摊金额
    const rentAlloc = allocateByDays(payout, chunks);      

    // 4) 事务内幂等 upsert
    await prisma.$transaction(async (tx) => {
        for (let i = 0; i < chunks.length; i++) {
        const periodMonthUTC = toUTCMonthStart(chunks[i].periodMonthLocal);

        // 4.1 确保当月分录头存在（唯一 periodMonth）
        const entry = await tx.journalEntry.upsert({
            where: { periodMonth: periodMonthUTC },
            create: {
            periodMonth: periodMonthUTC,
            memo: `Auto posting ${DateTime.fromJSDate(periodMonthUTC).toISODate()}`
            },
            update: {}
        });

        // 4.2 租金收入（应计）
        await tx.journalLine.upsert({
            where: {
            bookingId_account_periodMonth: {
                bookingId: booking.id,
                account: "RENT",  
                periodMonth: periodMonthUTC
            }
            },
            create: {
            journalId: entry.id,
            bookingId: booking.id,
            propertyId: booking.room?.propertyId,
            roomId: booking.roomId,
            account: "RENT",  
            amountCents: rentAlloc[i].cents, // 正
            periodMonth: periodMonthUTC
            },
            update: {
            amountCents: rentAlloc[i].cents
            }
        });

        }

        // 初次过账时补写时区快照
        if (!booking.tzSnapshot) {
        await tx.booking.update({
            where: { id: booking.id },
            data: { tzSnapshot: propertyTz }
        });
        }
    });

    return { posted: chunks.length };
}
