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



/** 获取指定 ledger 的成员 */
r.get("/:id/users", async (req, res) => {
    const { id } = req.params;
    const rows = await prisma.ledgerUser.findMany({
      where: { ledgerId: id },
      include: {
        user: { select: { id: true, email: true, name: true, role: true } }
      }
    });
    res.json(rows);
  });
  
  /** 给 ledger 添加成员 */
  r.post("/:id/users", async (req, res) => {
    const { id } = req.params;
    const { userId, role } = req.body;
    if (!userId) return res.status(400).json({ error: "userId required" });
  
    const created = await prisma.ledgerUser.create({
      data: { ledgerId: id, userId, role: role ?? "VIEWER" }
    });
  
    res.status(201).json(created);
  });
  
  /** 更新成员角色 */
  r.put("/:id/users/:userId", async (req, res) => {
    const { id, userId } = req.params;
    const { role } = req.body;
    const updated = await prisma.ledgerUser.update({
      where: { ledgerId_userId: { ledgerId: id, userId } },
      data: { role }
    });
    res.json(updated);
  });
  
  /** 删除成员 */
  r.delete("/:id/users/:userId", async (req, res) => {
    const { id, userId } = req.params;
    await prisma.ledgerUser.delete({
      where: { ledgerId_userId: { ledgerId: id, userId } }
    });
    res.status(204).end();
  });
export default r;
