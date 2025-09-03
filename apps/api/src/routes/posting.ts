// src/routes/posting.ts
import { Router } from "express";
import { prisma } from "../prisma";
import { monthStartUTC, nextMonthUTC } from "../utils/dates";
import { AccountCode } from "@prisma/client";

const r = Router();

/** 将单个 booking 的 RENT 按晚分摊到各自然月（幂等） */
r.post("/posting/booking/:id", async (req, res) => {
  const { id } = req.params;

  const booking = await prisma.bookingRecord.findUnique({
    where: { id },
    include: { room: { include: { property: true } } }
  });
  if (!booking) return res.status(404).json({ error: "Booking not found" });

  const ledgerId = booking.room.property.ledgerId;

  // 以日期（不含时分秒）计算晚数
  const ci = new Date(Date.UTC(booking.checkIn.getUTCFullYear(), booking.checkIn.getUTCMonth(), booking.checkIn.getUTCDate()));
  const co = new Date(Date.UTC(booking.checkOut.getUTCFullYear(), booking.checkOut.getUTCMonth(), booking.checkOut.getUTCDate()));
  const nightsTotal = Math.max(0, Math.round((co.getTime() - ci.getTime()) / 86400000));
  if (nightsTotal === 0) return res.json({ posted: 0 });

  const total = booking.payoutCents ?? 0;
  // 切月
  let cursor = new Date(ci);
  let posted = 0;
  while (cursor < co) {
    const mStart = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), 1));
    const mNext  = nextMonthUTC(mStart);
    const stop   = mNext < co ? mNext : co;
    const nights = Math.max(0, Math.round((stop.getTime() - cursor.getTime()) / 86400000));
    if (nights > 0) {
      const share = Math.round((total * nights) / nightsTotal);

      // 1) 取/建 JournalEntry
      const journal = await prisma.journalEntry.upsert({
        where: { periodMonth_ledgerId: { periodMonth: mStart, ledgerId } },
        update: {},
        create: { periodMonth: mStart, ledgerId, memo: "auto-post" }
      });

      // 2) 幂等插入 JournalLine（触发唯一键重复则忽略）
      try {
        await prisma.journalLine.create({
          data: {
            journalId: journal.id,
            bookingId: booking.id,
            account: AccountCode.RENT,
            amountCents: share
          }
        });
        posted++;
      } catch (e: any) {
        if (!(e?.code === "P2002")) throw e; // 非唯一冲突则抛出
      }
    }
    cursor = mNext;
  }

  res.json({ posted });
});

/** 批量：账簿 + 月份范围 */
r.post("/posting/run", async (req, res) => {
  const { ledgerId, fromMonth, toMonth } = req.body; // YYYY-MM
  if (!ledgerId || !fromMonth || !toMonth) return res.status(400).json({ error: "ledgerId/fromMonth/toMonth required" });
  const [fy, fm] = fromMonth.split("-").map(Number);
  const [ty, tm] = toMonth.split("-").map(Number);
  const fromUTC = monthStartUTC(fy, fm);
  const toUTC   = monthStartUTC(ty, tm);
  const endUTC  = nextMonthUTC(toUTC);

  const bookings = await prisma.bookingRecord.findMany({
    where: {
      room: { property: { ledgerId } },
      checkOut: { gte: fromUTC },
      checkIn:  { lt:  endUTC }
    },
    select: { id: true }
  });

  let lines = 0;
  for (const b of bookings) {
    const resp = await fetch(`${req.protocol}://${req.get("host")}/api/tasks/posting/booking/${b.id}`, { method: "POST" });
    if (resp.ok) {
      const { posted } = await resp.json();
      lines += posted;
    }
  }
  res.json({ bookings: bookings.length, linesCreated: lines });
});

export default r;
