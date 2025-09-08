// apps/api/src/routes/reports.ts
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { DateTime } from 'luxon';

const router = express.Router();
const prisma = new PrismaClient();

router.get('/ledger-summary', async (req, res) => {
  try {
    const fromStr = req.query.from as string;
    const toStr = req.query.to as string;

    if (!fromStr || !toStr) return res.status(400).json({ error: 'Missing from/to' });

    const start = DateTime.fromFormat(fromStr, 'yyyy-MM', { zone: 'utc' }).startOf('month').toJSDate();
    const end = DateTime.fromFormat(toStr, 'yyyy-MM', { zone: 'utc' }).endOf('month').toJSDate();

    // 找出该时间段内所有 journalEntry
    const entries = await prisma.journalEntry.findMany({
      where: {
        periodMonth: {
          gte: start,
          lte: end,
        },
      },
      select: {
        id: true,
        ledgerId: true,
        ledger: { select: { name: true } },
      },
    });

    if (entries.length === 0) return res.json({ rows: [] });

    const sums = await prisma.journalLine.groupBy({
      by: ['journalId'],
      where: { journalId: { in: entries.map(e => e.id) } },
      _sum: { amountCents: true },
    });

    const sumMap = new Map(sums.map(s => [s.journalId, s._sum.amountCents ?? 0]));

    const rows = entries.map(e => ({
      ledgerName: e.ledger?.name || '',
      ledgerId: e.ledgerId,
      journalId: e.id,
      amountCents: sumMap.get(e.id) ?? 0,
    }));

    // 聚合按 ledgerId 分组
    const groupMap = new Map();
    for (const row of rows) {
      const key = row.ledgerId;
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          ledgerId: row.ledgerId,
          ledgerName: row.ledgerName,
          amountCents: 0,
          count: 0,
        });
      }
      const g = groupMap.get(key);
      g.amountCents += row.amountCents;
      g.count += 1;
    }

    res.json({ rows: Array.from(groupMap.values()) });
  } catch (err) {
    console.error('ledger-summary error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
