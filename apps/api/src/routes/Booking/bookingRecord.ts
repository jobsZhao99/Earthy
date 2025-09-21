import { Router } from "express";
import { prisma } from "../../prisma.js";
import { getPagination } from "../../utils/pagination.js";
// import { postBookingAccruals } from "../../../Archieved/posting.js";
import { toDateOnly,toDateStr } from "../../utils/dates.js";
import {recalcBooking} from "../../services/recalBooking.js";
import { postBookingAccruals } from "../../services/posting.js";

const r = Router();

/** 列表：支持 一堆过滤 + 分页 */
r.get("/", async (req, res) => {
  const { bookingId, type, q, from, to, propertyIds } = req.query as any;
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

  // ✅ 新增过滤：from / to / propertyIds
  if (from || to || propertyIds) {
    where.AND = [];
    if (from) {
      where.AND.push({
        rangeEnd: { gte: new Date(from + "-01") },
      });
    }
    if (to) {
      // 用月底
      const [y, m] = to.split("-");
      const endDate = new Date(Number(y), Number(m), 0); // JS：月份从0开始，传 m 会自动到下月0号=上月最后一天
      where.AND.push({
        rangeStart: { lte: endDate },
      });
    }
    if (propertyIds) {
      const ids = String(propertyIds).split(",").filter(Boolean);
      where.AND.push({
        booking: {
          room: {
            propertyId: { in: ids },
          },
        },
      });
    }
  }

  const [rows, total] = await Promise.all([
    prisma.bookingRecord.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: {
        booking: {
          include: { room: {
            include: {
              property: { include: { ledger: true } },
            },
          } },
        },
        journalLines: true,
      },
    }),
    prisma.bookingRecord.count({ where }),
  ]);

  const rowsWithDates = rows.map((b) => ({
    ...b,
    rangeStart: toDateStr(b.rangeStart),
    rangeEnd: toDateStr(b.rangeEnd),
  }));

  res.json({ page, pageSize, total, rows: rowsWithDates });
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
  await recalcBooking(bookingId); // 👈 新建后自动更新 booking
  await postBookingAccruals(created.id);

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
  await recalcBooking(updated.bookingId); // 👈 新建后自动更新 booking
  await postBookingAccruals(updated.id);
  res.json(updated);
});

// /** 删除 */
// r.delete("/:id", async (req, res) => {
//   const deleted = await prisma.bookingRecord.delete({ where: { id: req.params.id } });
//   await recalcBooking(deleted.bookingId); // 👈 删除后 recalculation
//   await prisma.journalLine.deleteMany({ where: { bookingRecordId: deleted.id } });

//   res.status(204).end();
// });
r.delete("/:id", async (req, res) => {
  const recordId = req.params.id;
  try {
    // 先删掉 JournalLines
    await prisma.journalLine.deleteMany({
      where: { bookingRecordId: recordId },
    });

    // 再删 BookingRecord
    await prisma.bookingRecord.delete({
      where: { id: recordId },
    });

    res.status(204).end();
  } catch (err) {
    console.error("Delete bookingRecord failed:", err);
    res.status(500).json({ error: "Failed to delete bookingRecord" });
  }
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
