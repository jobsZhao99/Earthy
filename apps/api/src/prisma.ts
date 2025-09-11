// src/prisma.ts
import { PrismaClient } from "@prisma/client";

declare global {
  // 防止 dev 热重载多实例
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}


export const prisma =
  global.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") global.prisma = prisma;
