// src/routes/report.ts
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { DateTime } from 'luxon';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * 汇总报表：每个 ledger 在 from - to 区间的月度合计
 * GET /api/report/ledger-summary?from=2024-01&to=2024-12
 */
router.get('/ledger-summary', async (req, res) => {
  try {
    const fromStr = req.query.from as string;
    const toStr = req.query.to as string;

    if (!fromStr || !toStr) {
      return res.status(400).json({ error: 'Missing from/to' });
    }

    const startLuxon = DateTime.fromFormat(fromStr, 'yyyy-MM', { zone: 'utc' });
    const endLuxon = DateTime.fromFormat(toStr, 'yyyy-MM', { zone: 'utc' });

    if (!startLuxon.isValid || !endLuxon.isValid) {
      return res.status(400).json({ error: 'Invalid from/to date format' });
    }

    const start = startLuxon.startOf('month').toJSDate();
    const end = endLuxon.endOf('month').toJSDate();

    // 找到区间内的 journalEntry
    const entries = await prisma.journalEntry.findMany({
      where: {
        periodMonth: {
          gte: start,
          lte: end,
        },
      },
      include: {
        ledger: true,
        journalLines: {
          select: { amountCents: true },
        },
      },
    });

    if (!entries.length) return res.json({ rows: [] });

    // 转换为 { ledgerId, ledgerName, month, amount }
    const rows = entries.map((e) => {
      const dt = DateTime.fromJSDate(e.periodMonth).toFormat('yyyy-MM');
      const sum = e.journalLines.reduce((acc, l) => acc + (l.amountCents ?? 0), 0);
      return {
        ledgerId: e.ledgerId,
        ledgerName: e.ledger.name,
        month: dt,
        amountCents: sum,
      };
    });

    // 聚合：ledgerId 分组
    const grouped = new Map<
      string,
      { ledgerId: string; ledgerName: string; monthly: Record<string, number> }
    >();

    for (const r of rows) {
      if (!grouped.has(r.ledgerId)) {
        grouped.set(r.ledgerId, { ledgerId: r.ledgerId, ledgerName: r.ledgerName, monthly: {} });
      }
      const g = grouped.get(r.ledgerId)!;
      g.monthly[r.month] = (g.monthly[r.month] || 0) + r.amountCents;
    }

    res.json({ rows: Array.from(grouped.values()) });
  } catch (err: any) {
    console.error('ledger-summary error:', err.message, err.stack);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

export default router;
