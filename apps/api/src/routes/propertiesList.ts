import { Router } from 'express';
import { prisma } from "../prisma.js";

const r = Router();

// 获取所有 Property 的精简列表（仅 id 和 name）
r.get('/', async (req, res) => {
  try {
    const rows = await prisma.property.findMany({
      select: {
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
