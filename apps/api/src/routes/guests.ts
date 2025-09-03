import { Router } from "express";
import { prisma } from "../prisma.js";
import { getPagination } from "../utils/pagination.js";

const r = Router();

/** 列表 + 搜索 */
r.get("/", async (req, res) => {
  const { q } = req.query as any;
  const { skip, take, page, pageSize } = getPagination(req.query);
  const where: any = q ? {
    OR: [
      { name:  { contains: String(q), mode: "insensitive" } },
      { email: { contains: String(q), mode: "insensitive" } },
      { phone: { contains: String(q), mode: "insensitive" } },
    ],
  } : {};

  const [rows, total] = await Promise.all([
    prisma.guest.findMany({
      where, skip, take, orderBy: { createdAt: "desc" },
    }),
    prisma.guest.count({ where }),
  ]);
  res.json({ page, pageSize, total, rows });
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
  const updated = await prisma.guest.update({ where: { id: req.params.id }, data: req.body });
  res.json(updated);
});

/** 删除（若有 bookings 会报外键错误） */
r.delete("/:id", async (req, res) => {
  await prisma.guest.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

export default r;
