import { Router } from "express";
import { prisma } from "../prisma.js";
import { getPagination } from "../utils/pagination.js";
const r = Router();
/** 列表 + 搜索 */
r.get("/", async (req, res) => {
    const { q } = req.query;
    const { skip, take, page, pageSize } = getPagination(req.query);
    const where = q ? { name: { contains: String(q), mode: "insensitive" } } : {};
    const [rows, total] = await Promise.all([
        prisma.ledger.findMany({ where, skip, take, orderBy: { createdAt: "desc" } }),
        prisma.ledger.count({ where }),
    ]);
    res.json({ page, pageSize, total, rows });
});
/** 详情 */
r.get("/:id", async (req, res) => {
    const row = await prisma.ledger.findUnique({
        where: { id: req.params.id },
        include: { properties: true },
    });
    if (!row)
        return res.status(404).json({ error: "Not found" });
    res.json(row);
});
/** 新建 */
r.post("/", async (req, res) => {
    const { name } = req.body;
    if (!name)
        return res.status(400).json({ error: "name required" });
    const created = await prisma.ledger.create({ data: { name } });
    res.status(201).json(created);
});
/** 更新 */
r.patch("/:id", async (req, res) => {
    const updated = await prisma.ledger.update({ where: { id: req.params.id }, data: req.body });
    res.json(updated);
});
/** 删除（若有子表会报外键错误，前端引导先迁移/删除子记录） */
r.delete("/:id", async (req, res) => {
    await prisma.ledger.delete({ where: { id: req.params.id } });
    res.status(204).end();
});
export default r;
