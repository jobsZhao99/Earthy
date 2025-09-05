import { Router } from "express";
import { prisma } from "../prisma.js";
import { getPagination } from "../utils/pagination.js";
const r = Router();
/** 列表 + 过滤 ledger / 搜索 */
r.get("/", async (req, res) => {
    const { ledgerId, q } = req.query;
    const { skip, take, page, pageSize } = getPagination(req.query);
    const where = {};
    if (ledgerId)
        where.ledgerId = String(ledgerId);
    if (q)
        where.name = { contains: String(q), mode: "insensitive" };
    const [rows, total] = await Promise.all([
        prisma.property.findMany({
            where, skip, take,
            orderBy: { createdAt: "desc" },
            include: { rooms: true },
        }),
        prisma.property.count({ where }),
    ]);
    res.json({ page, pageSize, total, rows });
});
/** 详情 */
r.get("/:id", async (req, res) => {
    const row = await prisma.property.findUnique({
        where: { id: req.params.id },
        include: { rooms: true, ledger: true },
    });
    if (!row)
        return res.status(404).json({ error: "Not found" });
    res.json(row);
});
/** 新建 */
r.post("/", async (req, res) => {
    const { ledgerId, name, address, timezone } = req.body;
    if (!ledgerId || !name)
        return res.status(400).json({ error: "ledgerId & name required" });
    const created = await prisma.property.create({
        data: { ledgerId, name, address, timezone },
    });
    res.status(201).json(created);
});
/** 更新 */
r.patch("/:id", async (req, res) => {
    const updated = await prisma.property.update({ where: { id: req.params.id }, data: req.body });
    res.json(updated);
});
/** 删除（有子级时会报错；如需“级联删除”，见下方“安全删除示例”） */
r.delete("/:id", async (req, res) => {
    await prisma.property.delete({ where: { id: req.params.id } });
    res.status(204).end();
});
export default r;
