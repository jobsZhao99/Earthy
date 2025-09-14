// GET /reports/ledger-monthly-summary?from=2025-03&to=2025-08&propertyIds=abc,def,ghi

import express from 'express';
import { PrismaClient } from '@prisma/client';
import { DateTime } from 'luxon';

const router = express.Router();
const prisma = new PrismaClient();

router.get('/', async (req, res) => {
  try {
    const fromStr = req.query.from as string;
    const toStr = req.query.to as string;
    const propertyIdsRaw = req.query.propertyIds as string;
    const propertyIds = propertyIdsRaw?.split(',').filter(Boolean);

    if (!fromStr || !toStr || !propertyIds?.length) {
      return res.status(400).json({ error: 'Missing from/to/propertyIds' });
    }

    const start = DateTime.fromFormat(fromStr, 'yyyy-MM').startOf('month').toJSDate();
    const end = DateTime.fromFormat(toStr, 'yyyy-MM').endOf('month').toJSDate();

    const lines = await prisma.journalLine.findMany({
      where: {
        journal: {
          periodMonth: {
            gte: start,
            lte: end,
          },
        },
        booking: {
          room: {
            propertyId: {
              in: propertyIds,
            },
          },
        },
      },
      include: {
        journal: {
          select: { periodMonth: true },
        },
        booking: {
          select: {
            room: {
              select: {
                property: {
                  select: {
                    id: true,
                    name: true,
                    ledgerId: true,
                    ledger: {
                      select: { id: true, name: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const map = new Map(); // key: ledgerId

    for (const line of lines) {
      const ledgerId = line.booking.room.property.ledger.id;
      const ledgerName = line.booking.room.property.ledger.name;
      const month = DateTime.fromJSDate(line.journal.periodMonth).toFormat('yyyy-MM');

      if (!map.has(ledgerId)) {
        map.set(ledgerId, {
          ledgerId,
          ledgerName,
          monthly: {},
        });
      }

      const entry = map.get(ledgerId);
      entry.monthly[month] = (entry.monthly[month] || 0) + line.amountCents;
    }

    res.json({ rows: Array.from(map.values()) });
  } catch (err) {
    console.error('ledger-monthly-summary error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
