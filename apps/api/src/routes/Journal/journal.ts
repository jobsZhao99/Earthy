import { Router } from "express";
import { prisma } from "../../prisma.js";
import { monthStartUTC } from "../../utils/dates.js";
import { AccountCode } from "@prisma/client";

const r = Router();

/** 获取某账簿、某月的 JournalEntry + Lines */
r.get("/entries", async (req, res) => {
  const { ledgerId, month } = req.query as any; // month = YYYY-MM
  if (!ledgerId || !month)
    return res.status(400).json({ error: "ledgerId & month(YYYY-MM) required" });

  const [y, m] = String(month).split("-").map(Number);
  const periodMonth = monthStartUTC(y, m);

  const row = await prisma.journalEntry.findUnique({
    where: { periodMonth_ledgerId: { periodMonth, ledgerId } },
    include: {
      journalLines: {
        include: {
          bookingRecord: {
            include: {
              booking: {
                include: {
                  room: { include: { property: true } },
                  guest: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  res.json(row || null);
});

/** 给某月账簿，手动新增一条 JournalLine（比如 PARKING/CLEANING） */
r.post("/lines", async (req, res) => {
  const { ledgerId, month, bookingRecordId, account, amountCents, memo } = req.body;
  if (!ledgerId || !month || !bookingRecordId || !account || amountCents === undefined) {
    return res.status(400).json({
      error: "ledgerId/month/bookingRecordId/account/amountCents required",
    });
  }

  const [y, m] = String(month).split("-").map(Number);
  const periodMonth = monthStartUTC(y, m);

  // 确保 JournalEntry 存在
  const journal = await prisma.journalEntry.upsert({
    where: { periodMonth_ledgerId: { periodMonth, ledgerId } },
    update: {},
    create: { periodMonth, ledgerId, memo: memo || "manual" },
  });

  // 幂等：RENT 科目 + 唯一键 (bookingRecordId, account, journalId)
  const created = await prisma.journalLine.create({
    data: { journalId: journal.id, bookingRecordId, account, amountCents },
  });

  res.status(201).json(created);
});

/** 更新一条 JournalLine（金额/科目） */
r.patch("/lines/:id", async (req, res) => {
  const updated = await prisma.journalLine.update({
    where: { id: req.params.id },
    data: {
      account: req.body.account as AccountCode | undefined,
      amountCents: req.body.amountCents,
    },
  });
  res.json(updated);
});

/** 删除一条 JournalLine */
r.delete("/lines/:id", async (req, res) => {
  await prisma.journalLine.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

export default r;
