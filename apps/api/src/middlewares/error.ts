// src/middlewares/error.ts
import type { Request, Response, NextFunction } from "express";

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  // Prisma 唯一键冲突
  if (err?.code === "P2002") {
    return res.status(409).json({ error: "Unique constraint violation", meta: err.meta });
  }
  console.error(err);
  res.status(500).json({ error: "Internal Server Error" });
}
