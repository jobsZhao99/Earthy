import { Router } from "express";
import { prisma } from "../prisma.js";
import { getPagination } from "../utils/pagination.js";
const r = Router();
/** 列表 + 过滤 propertyId / 搜索 */
r.get("/", async (req, res) => {
    const { propertyId, q } = req.query;
    const { skip, take, page, pageSize } = getPagination(req.query);
    const where = {};
    if (propertyId)
        where.propertyId = String(propertyId);
    if (q)
        where.label = { contains: String(q), mode: "insensitive" };
    const [rows, total] = await Promise.all([
        prisma.room.findMany({
            where, skip, take, orderBy: { label: "asc" },
            include: { property: true },
        }),
        prisma.room.count({ where }),
    ]);
    res.json({ page, pageSize, total, rows });
});
/** 详情 */
r.get("/:id", async (req, res) => {
    const row = await prisma.room.findUnique({
        where: { id: req.params.id },
        include: { property: true },
    });
    if (!row)
        return res.status(404).json({ error: "Not found" });
    res.json(row);
});
/** 新建 */
r.post("/", async (req, res) => {
    const { propertyId, label, nightlyRateCents } = req.body;
    if (!propertyId || !label)
        return res.status(400).json({ error: "propertyId & label required" });
    const created = await prisma.room.create({ data: { propertyId, label, nightlyRateCents } });
    res.status(201).json(created);
});
/** 更新 */
r.patch("/:id", async (req, res) => {
    const updated = await prisma.room.update({ where: { id: req.params.id }, data: req.body });
    res.json(updated);
});
/** 删除（存在 booking 时会报错） */
r.delete("/:id", async (req, res) => {
    await prisma.room.delete({ where: { id: req.params.id } });
    res.status(204).end();
});
export default r;
