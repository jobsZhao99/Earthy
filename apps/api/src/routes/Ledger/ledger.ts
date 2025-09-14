// src/routes/ledgers.ts
import { Router } from "express";
import { prisma } from "../../prisma.js";
import { getPagination } from "../../utils/pagination.js";
import { Prisma } from "@prisma/client";

const r = Router();

/** 列表 + 搜索 */
r.get("/", async (req, res) => {
  const { q } = req.query as any;
  const { skip, take, page, pageSize } = getPagination(req.query);

  const where: Prisma.LedgerWhereInput = q
    ? { name: { contains: String(q), mode: Prisma.QueryMode.insensitive } }
    : {};

  const [rows, total] = await Promise.all([
    prisma.ledger.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
    }),
    prisma.ledger.count({ where }),
  ]);

  res.json({ page, pageSize, total, rows });
});

/** 详情 */
r.get("/:id", async (req, res) => {
  const row = await prisma.ledger.findUnique({
    where: { id: req.params.id },
    include: {
      properties: true,
      journalEntries: {
        include: { journalLines: true },
        orderBy: { periodMonth: "desc" },
      },
    },
  });
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(row);
});

/** 新建 */
r.post("/", async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "name required" });

  try {
    const created = await prisma.ledger.create({ data: { name } });
    res.status(201).json(created);
  } catch (err: any) {
    if (err.code === "P2002") {
      // 唯一约束错误
      return res.status(400).json({ error: "Ledger name must be unique" });
    }
    throw err;
  }
});

/** 更新 */
r.patch("/:id", async (req, res) => {
  const updated = await prisma.ledger.update({
    where: { id: req.params.id },
    data: req.body,
  });
  res.json(updated);
});

/** 删除（若有关联会报错） */
r.delete("/:id", async (req, res) => {
  try {
    await prisma.ledger.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (err: any) {
    if (err.code === "P2003") {
      return res
        .status(400)
        .json({ error: "Cannot delete ledger with linked properties or journal entries" });
    }
    throw err;
  }
});

export default r;
