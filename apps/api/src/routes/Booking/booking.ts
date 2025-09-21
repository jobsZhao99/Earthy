// src/routes/booking.ts
import { Router } from 'express';
import { prisma} from '../../prisma.js';           // ← 路径根据你的文件实际位置调整
import { Prisma,BookingStatus } from '@prisma/client';
import { toDateOnly,toDateStr } from '../../utils/dates.js';
import { getPagination } from '../../utils/pagination.js';

const r = Router();

r.get('/', async (req, res) => {
  const { skip, take, page, pageSize } = getPagination(req.query);

  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const propertyId = typeof req.query.propertyId === 'string' ? req.query.propertyId : null;
  const guestId = typeof req.query.guestId === 'string' ? req.query.guestId : null;

  const ci = Prisma.QueryMode.insensitive;

  const where: Prisma.BookingWhereInput = {};

  // propertyId filter
  if (propertyId) {
    where.room = { propertyId };
  }
  if (guestId) {
    where.guestId = guestId;
  }

  // search filter
  if (search) {
    where.OR = [
      { externalRef: { contains: search, mode: ci } },
      { memo: { contains: search, mode: ci } },
      {
        guest: {
          is: {
            OR: [
              { name: { contains: search, mode: ci } },
              { email: { contains: search, mode: ci } },
              { phone: { contains: search, mode: ci } },
            ],
          },
        },
      },
      {
        room: {
          is: {
            OR: [
              { label: { contains: search, mode: ci } },
              { property: { is: { name: { contains: search, mode: ci } } } },
            ],
          },
        },
      },
      {
        channel: {
          is: { label: { contains: search, mode: ci } },
        },
      },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        guest: true,
        room: { include: { property: true } },
        channel: true,
      },
    }),
    prisma.booking.count({ where }),
  ]);

  const rowsWithDates = rows.map((b) => ({
    ...b,
    checkIn: toDateStr(b.checkIn),
    checkOut: toDateStr(b.checkOut),
  }));

  res.json({ rows: rowsWithDates, total, page, pageSize });
});

/** 获取单个
 * GET /api/booking/:id
 */
r.get('/:id', async (req, res) => {
  const row = await prisma.booking.findUnique({
    where: { id: req.params.id },
    include: {
      guest: true,
      room: { include: { property: true } },
      channel: true,
      bookingRecords: {
        include: {
          journalLines: true,  // 👈 加上这个
        },
      },
    },
  });
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json({
    ...row,
    checkIn: toDateStr(row.checkIn),
    checkOut: toDateStr(row.checkOut),
  });
});

/** 新建
 * POST /api/booking
 */
r.post('/', async (req, res) => {
  try {
    const {
      roomId,
      guestId,
      status,             // 可选
      checkIn,
      checkOut,
      guestTotalCents,
      payoutCents,
      channelId,
      externalRef,
      memo,
    } = req.body;

    if (!roomId || !guestId || !channelId || !checkIn || !checkOut) {
      return res.status(400).json({ error: 'roomId, guestId, channelId, checkIn, checkOut required' });
    }

    const created = await prisma.booking.create({
      data: {
        roomId,
        guestId,
        status: status as BookingStatus | undefined, // 若传了就用
        checkIn: toDateOnly(checkIn),
        checkOut: toDateOnly(checkOut),
        guestTotalCents: guestTotalCents ?? null,
        payoutCents: payoutCents ?? null,
        channelId,
        externalRef: externalRef ?? null,
        memo: memo ?? null,
      },
    });
    res.status(201).json(created);
  } catch (err) {
    console.error('Create booking failed:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/** 更新
 * PATCH /api/booking/:id
 */
r.patch('/:id', async (req, res) => {
  try {
    const { checkIn, checkOut, ...rest } = req.body;

    const data: Prisma.BookingUpdateInput = {
      ...rest,
      ...(checkIn ? { checkIn: toDateOnly(checkIn) } : {}),
      ...(checkOut ? { checkOut: toDateOnly(checkOut) } : {}),
    };

    const updated = await prisma.booking.update({
      where: { id: req.params.id },
      data,
    });
    res.json(updated);
  } catch (err) {
    console.error('Update booking failed:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/** 删除
 * DELETE /api/booking/:id
 */
r.delete('/:id', async (req, res) => {
  try {
    await prisma.booking.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (err) {
    console.error('Delete booking failed:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default r;
