// src/services/posting.ts
import { PrismaClient, AccountCode } from "@prisma/client";
import { DateTime } from "luxon";
import { DEFAULT_TIMEZONE } from "../config.js";

const prisma = new PrismaClient();


/** 把入住/退房按“物业时区”的自然月切成若干段，返回每段晚数及对应的 UTC 会计月 */
function splitNightsByMonthTZ(checkIn: Date, checkOut: Date, tz: string) {
  // 晚数口径：退房日不计晚；用 tz 对齐到各地的自然日
  const ci = DateTime.fromJSDate(checkIn).setZone(tz).startOf("day");
  const co = DateTime.fromJSDate(checkOut).setZone(tz).startOf("day");
  if (co <= ci) return [];

  const chunks: { periodMonthUTC: Date; nights: number }[] = [];
  let cursor = ci;
  while (cursor < co) {
    const monthStartLocal = cursor.startOf("month");
    const nextMonthLocal = monthStartLocal.plus({ months: 1 });
    const stop = co < nextMonthLocal ? co : nextMonthLocal;
    const nights = Math.max(0, Math.round(stop.diff(cursor, "days").days));
    if (nights > 0) {
      // 账期按“该地月初”对应的 UTC 月初存 periodMonth
      const periodMonthUTC = monthStartLocal.toUTC().startOf("month").toJSDate();
      chunks.push({ periodMonthUTC, nights });
    }
    cursor = nextMonthLocal;
  }
  return chunks;
}

/** 将单个 BookingRecord 的 RENT 按晚分摊到各自然月（幂等） */
export async function postBookingAccruals(bookingId: string) {
  const booking = await prisma.bookingRecord.findUnique({
    where: { id: bookingId },
    include: { room: { include: { property: true } } }
  });
  if (!booking) throw new Error("Booking not found");

  const tz = booking.tzSnapshot || booking.room.property.timezone || DEFAULT_TIMEZONE;
  const ledgerId = booking.room.property.ledgerId;

  // 切月 + 计算总晚数
  const chunks = splitNightsByMonthTZ(booking.checkIn, booking.checkOut, tz);
  // 打印详细内容
  // console.log("切分结果 chunks:", chunks.map(c => ({
  //   monthUTC: c.periodMonthUTC.toISOString(),
  //   nights: c.nights
  // })));
  const totalNights = chunks.reduce((s, c) => s + c.nights, 0);
  if (totalNights === 0) return { posted: 0 };

  // 金额口径：用 payoutCents；无则为 0（你也可改为 nightlyRateCents * 晚数）
  const totalCents = booking.payoutCents ?? 0;
  const totalDays = totalNights + 1;
  // 分摊金额（按晚均分）
  let createdLines = 0;
  let allocatedCents = 0;
  let allocatedDays = 0;
  for (let i = 0; i < chunks.length; i++) {
    const { periodMonthUTC, nights } = chunks[i];

    // 当月作为“天”的基数
    const baseDays =
      i < chunks.length - 1
        ? nights // 前N-1个月，直接用 nights
        : Math.max(0, totalDays - allocatedDays); // 最后一个月包含额外那1天

    // 分配金额：前N-1个月按比例四舍五入，最后一个月用剩余收口
    const share =
      i < chunks.length - 1
        ? Math.round((totalCents * baseDays) / totalDays)
        : totalCents - allocatedCents;

    allocatedCents += share;
    allocatedDays += baseDays;
    // console.log("切分结果 :",i, share);
    await prisma.$transaction(async (tx) => {

      // —— 1) 取/建当月分录（periodMonth+ledgerId 唯一）——
      const journal = await tx.journalEntry.upsert({
        where: { periodMonth_ledgerId: { periodMonth: periodMonthUTC, ledgerId } },
        update: {},
        create: {
          periodMonth: periodMonthUTC,
          ledgerId,
          memo: `Auto posting ${DateTime.fromJSDate(periodMonthUTC).toISODate()}`
        }
      });
  

      // 2) 幂等写入当月该订单的 RENT 行（唯一：bookingId+account+journalId）
      try {
        await tx.journalLine.create({
          data: {
            journalId: journal.id,
            bookingId: booking.id,
            account: AccountCode.RENT,
            amountCents: share
          }
        });
        createdLines += 1;
      } catch (e: any) {
        // 已存在则忽略（P2002 为唯一键冲突）
        if (e?.code !== "P2002") throw e;
      }
    });


  }

    // 3) 补写 tz 快照（只在首次过账时）
  // 事务外再补 tzSnapshot（避免把整段都包进事务）
  if (!booking.tzSnapshot) {
    await prisma.bookingRecord.update({ where: { id: booking.id }, data: { tzSnapshot: tz } });
  }


  return { posted: createdLines, months: chunks.length, totalNights, totalCents };
}
