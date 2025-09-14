// apps/api/src/routes/today-booking.ts
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { DateTime } from 'luxon';

const router = Router();
const prisma = new PrismaClient();

const todayStart = DateTime.now().startOf('day').toISO();      // 2025-09-08T00:00:00.000Z
const tomorrowStart = DateTime.now().plus({ days: 1 }).startOf('day').toISO(); // 2025-09-09T00:00:00.000Z

// GET /api/reports/checkins-today
router.get('/today-bookings', async (req, res) => {
  try {
    const { propertyId } = req.query;
    const today = DateTime.now().toISODate(); // e.g. "2025-09-08"

    const bookings = await prisma.bookingRecord.findMany({
      where: {
        AND: [
          propertyId ? { room: { propertyId: String(propertyId) } } : {},
          {
            OR: [
                {
                    checkIn: {
                      gte: todayStart,
                      lt: tomorrowStart,
                    },
                  },
                  {
                    checkOut: {
                      gte: todayStart,
                      lt: tomorrowStart,
                    },
                  },
            ],
          },
        ],
      },
      include: {
        guest: true,
        room: {
          include: {
            property: true,
          },
        },
      },
      orderBy: {
        checkIn: 'asc',
      },
    });

    res.json({ rows: bookings });
  } catch (error) {
    console.error('❌ Error in /reports/checkins-today:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
