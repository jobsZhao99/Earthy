
import { Router } from 'express';
import { prisma } from "../prisma.js";

const r = Router();

// 获取所有 Property 的精简列表（支持 includeRooms）
r.get('/', async (req, res) => {
  try {
    const includeRooms = req.query.includeRooms === 'true';

    const rows = await prisma.property.findMany({
      select: includeRooms
      ? {
          id: true,
          name: true,
          rooms: {
            select: {
              id: true,
              label: true,
              bookings: {
                select: {
                  id: true,
                  checkIn: true,
                  checkOut: true,
                  status: true,
                },
              },
            },
            orderBy: { label: "asc" },
          },
        }
      : {
          id: true,
          name: true,
        },
      orderBy: { createdAt: 'desc' },
    });

    res.json(rows);
  } catch (err) {
    console.error('Failed to fetch property list:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default r;