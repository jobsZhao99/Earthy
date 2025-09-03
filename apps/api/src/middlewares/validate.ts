// src/middlewares/validate.ts
import type { Request, Response, NextFunction } from "express";

export function requireBody(fields: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    for (const f of fields) {
      if (req.body[f] === undefined) return res.status(400).json({ error: `Missing field: ${f}` });
    }
    next();
  };
}
