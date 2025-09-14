// src/routes/properties.ts
import { Router } from "express";
import { prisma } from "../../prisma.js";
import { getPagination } from "../../utils/pagination.js";
import { Prisma } from "@prisma/client";

const r = Router();

/** 列表 + 过滤 ledger / 搜索 */
r.get("/", async (req, res) => {
  const { ledgerId, search } = req.query as any;
  const { skip, take, page, pageSize } = getPagination(req.query);

  const where: Prisma.PropertyWhereInput = {};
  if (ledgerId) where.ledgerId = String(ledgerId);
  if (search) {
    where.name = { contains: String(search), mode: Prisma.QueryMode.insensitive };
  }

  const [rows, total] = await Promise.all([
    prisma.property.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: { rooms: true, ledger: true },
    }),
    prisma.property.count({ where }),
  ]);

  res.json({ page, pageSize, total, rows });
});


/** 精简列表（支持 includeRooms） */
r.get("/list", async (req, res) => {
  try {
    const includeRooms = req.query.includeRooms === "true";

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
      orderBy: { createdAt: "desc" },
    });

    res.json(rows);
  } catch (err) {
    console.error("Failed to fetch property list:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/** 详情 */
r.get("/:id", async (req, res) => {
  const row = await prisma.property.findUnique({
    where: { id: req.params.id },
    include: { rooms: true, ledger: true },
  });
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(row);
});

/** 新建 */
r.post("/", async (req, res) => {
  const { ledgerId, name, address, timezone } = req.body;
  if (!ledgerId || !name) {
    return res.status(400).json({ error: "ledgerId & name required" });
  }

  try {
    const created = await prisma.property.create({
      data: { ledgerId, name, address, timezone },
    });
    res.status(201).json(created);
  } catch (err: any) {
    if (err.code === "P2002") {
      return res
        .status(400)
        .json({ error: "Property name must be unique within a ledger" });
    }
    throw err;
  }
});

/** 更新 */
r.patch("/:id", async (req, res) => {
  const updated = await prisma.property.update({
    where: { id: req.params.id },
    data: req.body,
  });
  res.json(updated);
});

/** 删除（有子级时会报错） */
r.delete("/:id", async (req, res) => {
  try {
    await prisma.property.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (err: any) {
    if (err.code === "P2003") {
      return res
        .status(400)
        .json({ error: "Cannot delete property with linked rooms/bookings" });
    }
    throw err;
  }
});

export default r;
