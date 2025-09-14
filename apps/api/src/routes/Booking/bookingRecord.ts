import { Router } from "express";
import { prisma } from "../../prisma.js";
import { getPagination } from "../../utils/pagination.js";
import { postBookingAccruals } from "../../services/posting.js";
import { toDateOnly,toDateStr } from "../../utils/dates.js";
const r = Router();

/** 列表：支持 一堆过滤 + 分页 */
r.get("/", async (req, res) => {
  const { bookingId, type, q } = req.query as any;
  const { skip, take, page, pageSize } = getPagination(req.query);

  const where: any = {};
  if (bookingId) where.bookingId = String(bookingId);
  if (type) where.type = String(type);


  if (q) {
    where.OR = [
      { memo: { contains: String(q), mode: "insensitive" } },
      {
        booking: {
          is: {
            externalRef: { contains: String(q), mode: "insensitive" },
          },
        },
      },
    ];
  }


  const [rows, total] = await Promise.all([
    prisma.bookingRecord.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: {
        booking: {
          include: { room: { include: { property: true } }, guest: true, channel: true },
        },
        journalLines: true,
      },
    }),
    prisma.bookingRecord.count({ where }),
  ]);

  const rowsWithDates = rows.map((b) => {
    return {
      ...b,
      rangeStart: toDateStr(b.rangeStart),
      rangeEnd: toDateStr(b.rangeEnd),
    };
  });

  res.json({ page, pageSize, total, rows:rowsWithDates });

});

/** 详情 */
r.get("/:id", async (req, res) => {
  const row = await prisma.bookingRecord.findUnique({
    where: { id: req.params.id },
    include: {
      booking: {
        include: { room: { include: { property: true } }, guest: true, channel: true },
      },
      journalLines: true,
    },
  });
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json({
    ...row,
    rangeStart: toDateStr(row.rangeStart),
    rangeEnd: toDateStr(row.rangeEnd),
  });
});

/** 新建 */
r.post("/", async (req, res) => {
  const { bookingId, type, guestDeltaCents, payoutDeltaCents, rangeStart, rangeEnd, memo } = req.body;
  if (!bookingId) return res.status(400).json({ error: "bookingId required" });

  const created = await prisma.bookingRecord.create({
    data: {
      bookingId,
      type,
      guestDeltaCents,
      payoutDeltaCents,
      rangeStart: toDateOnly(rangeStart),
      rangeEnd: toDateOnly(rangeEnd),
      memo,
    },
  });
  res.status(201).json(created);
});

/** 批量创建 */
r.post("/bulk", async (req, res) => {
  const items = Array.isArray(req.body) ? req.body : [];
  if (!items.length) return res.status(400).json({ error: "array body required" });

  const data = items.map((x) => ({
    bookingId: x.bookingId,
    type: x.type,
    guestDeltaCents: x.guestDeltaCents,
    payoutDeltaCents: x.payoutDeltaCents,
    rangeStart: toDateOnly(x.rangeStart),
    rangeEnd: toDateOnly(x.rangeEnd),
    memo: x.memo,
  }));
  const created = await prisma.bookingRecord.createMany({ data, skipDuplicates: true });
  res.status(201).json(created);
});



/** 更新 */
/** 更新 */
r.patch("/:id", async (req, res) => {
  const data: any = { ...req.body };
  if (data.rangeStart) data.rangeStart = toDateOnly(data.rangeStart);
  if (data.rangeEnd) data.rangeEnd = toDateOnly(data.rangeEnd);

  const updated = await prisma.bookingRecord.update({
    where: { id: req.params.id },
    data,
  });
  res.json(updated);
});

/** 删除 */
r.delete("/:id", async (req, res) => {
  await prisma.bookingRecord.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

/** 批量删除（危险操作） */
r.delete("/", async (req, res) => {
  const { bookingId, before } = req.query as any;
  const where: any = {};
  if (bookingId) where.bookingId = String(bookingId);
  if (before) where.createdAt = { lt: new Date(String(before)) };

  const out = await prisma.bookingRecord.deleteMany({ where });
  res.json(out);
});

export default r;
