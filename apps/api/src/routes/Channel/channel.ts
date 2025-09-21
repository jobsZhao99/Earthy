import { Router } from "express";
import { prisma } from "../../prisma.js";

const r = Router();

/** 列表 */
r.get("/", async (_req, res) => {
  const rows = await prisma.channel.findMany({
    orderBy: { label: "asc" },
  });
  res.json({ rows });
});

/** 详情 */
r.get("/:id", async (req, res) => {
  const row = await prisma.channel.findUnique({
    where: { id: req.params.id },
  });
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(row);
});

/** 新建 */
r.post("/", async (req, res) => {
  const { label } = req.body;
  if (!label) return res.status(400).json({ error: "label required" });
  try {
    const created = await prisma.channel.create({
      data: { label },
    });
    res.status(201).json(created);
  } catch (err: any) {
    if (err.code === "P2002") {
      return res.status(400).json({ error: "Channel label must be unique" });
    }
    throw err;
  }
});

/** 更新 */
r.patch("/:id", async (req, res) => {
  try {
    const updated = await prisma.channel.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(updated);
  } catch (err: any) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Not found" });
    }
    throw err;
  }
});

/** 删除 */
r.delete("/:id", async (req, res) => {
  try {
    await prisma.channel.delete({
      where: { id: req.params.id },
    });
    res.status(204).end();
  } catch (err: any) {
    if (err.code === "P2003") {
      return res.status(400).json({ error: "Cannot delete channel with existing bookings" });
    }
    throw err;
  }
});

export default r;
