import { Router } from "express";
import { prisma } from "../prisma.js";
import { getPagination } from "../utils/pagination.js";
import { Prisma } from "@prisma/client";   // ✅ 必须引入 Prisma

const r = Router();

/** 列表 + 搜索 */
r.get("/", async (req, res) => {
  const pageRaw = req.query.page;
  const pageSizeRaw = req.query.pageSize;

  const page = typeof pageRaw === "string" ? parseInt(pageRaw) : 1;
  const pageSize = typeof pageSizeRaw === "string" ? parseInt(pageSizeRaw) : 20;

  const rawSearch = req.query.search;
  const search = typeof rawSearch === "string" ? rawSearch.toLowerCase().trim() : "";
  const includeBookingCount = req.query.includeBookingCount === "true";

  // ✅ 用 search 代替 keyword
  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: Prisma.QueryMode.insensitive } },
          { email: { contains: search, mode: Prisma.QueryMode.insensitive } },
          { phone: { contains: search, mode: Prisma.QueryMode.insensitive } },
        ],
      }
    : {};

  const [rows, total] = await Promise.all([
    prisma.guest.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: includeBookingCount
        ? { _count: { select: { bookings: true } } }
        : {},
    }),
    prisma.guest.count({ where }),
  ]);

  res.json({ rows, total });
});

/** 详情（含全部 bookings） */
r.get("/:id", async (req, res) => {
  const row = await prisma.guest.findUnique({
    where: { id: req.params.id },
    include: {
      bookings: {
        include: { room: { include: { property: true } } },
        orderBy: { checkIn: "desc" },
      },
    },
  });
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(row);
});

/** 新建 */
r.post("/", async (req, res) => {
  const { name, email, phone } = req.body;
  if (!name) return res.status(400).json({ error: "name required" });
  const created = await prisma.guest.create({ data: { name, email, phone } });
  res.status(201).json(created);
});

/** 更新 */
r.patch("/:id", async (req, res) => {
  const updated = await prisma.guest.update({
    where: { id: req.params.id },
    data: req.body,
  });
  res.json(updated);
});

/** 删除（若有 bookings 会报外键错误） */
r.delete("/:id", async (req, res) => {
  await prisma.guest.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

export default r;
