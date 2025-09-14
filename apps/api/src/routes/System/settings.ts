import { Router } from "express";
import { prisma } from "../../prisma.js";

const r = Router();

// 获取配置
r.get("/:key", async (req, res) => {
  const row = await prisma.setting.findUnique({ where: { key: req.params.key } });
  res.json(row ? row.value : {});
});

// 保存配置
r.post("/:key", async (req, res) => {
  const { key } = req.params;
  const value = req.body;
  const row = await prisma.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
  res.json(row.value);
});

export default r;
