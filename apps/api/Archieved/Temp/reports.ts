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

    const startLuxon = DateTime.fromFormat(fromStr, 'yyyy-MM', { zone: 'utc' });
    const endLuxon = DateTime.fromFormat(toStr, 'yyyy-MM', { zone: 'utc' });

    if (!startLuxon.isValid || !endLuxon.isValid) {
      return res.status(400).json({ error: 'Invalid from/to date format' });
    }

    const start = startLuxon.startOf('month').toJSDate();
    const end = endLuxon.endOf('month').toJSDate();

    // console.log('Fetching journalEntry...');
    const entries = await prisma.journalEntry.findMany({
      where: {
        periodMonth: {
          gte: start,
          lte: end,
        },
      },
      select: {
        id: true,
        periodMonth: true,
        ledgerId: true,
        ledger: { select: { name: true } },
      },
    });

    // console.log('Entries:', entries.length);
    if (entries.length === 0) return res.json({ rows: [] });

    const sums = await prisma.journalLine.groupBy({
      by: ['journalId'],
      where: { journalId: { in: entries.map(e => e.id) } },
      _sum: { amountCents: true },
    });

    const sumMap = new Map(sums.map(s => [s.journalId, s._sum.amountCents ?? 0]));

    // 构建 rows：每条记录附上月份
    const rows = entries.map(e => {
      const dt = DateTime.fromJSDate(e.periodMonth).toFormat('yyyy-MM');
      return {
        ledgerName: e.ledger?.name || '',
        ledgerId: e.ledgerId,
        journalId: e.id,
        amountCents: sumMap.get(e.id) ?? 0,
        month: dt,
      };
    });

    // 聚合：ledgerId + month 为 key
    const grouped = new Map();
    for (const row of rows) {
      const key = `${row.ledgerId}_${row.month}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          ledgerId: row.ledgerId,
          ledgerName: row.ledgerName,
          monthly: {},
        });
      }
      const g = grouped.get(key);
      g.monthly[row.month] = (g.monthly[row.month] || 0) + row.amountCents;
    }

    // 转换为 frontend 需要的格式：每个 ledger 一行
    const final = Array.from(grouped.values()).reduce((acc, curr) => {
      let existing = acc.find((x: any) => x.ledgerId === curr.ledgerId);
      if (!existing) {
        existing = {
          ledgerId: curr.ledgerId,
          ledgerName: curr.ledgerName,
          monthly: {},
        };
        acc.push(existing);
      }
      existing.monthly = { ...existing.monthly, ...curr.monthly };
      return acc;
    }, []);

    res.json({ rows: final });
  } catch (err: any) {
    console.error('ledger-summary error:', err.message, err.stack);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

export default router;
