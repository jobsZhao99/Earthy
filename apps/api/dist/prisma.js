// src/prisma.ts
import { PrismaClient } from "@prisma/client";
export const prisma = global.prisma ||
    new PrismaClient({
    // 可酌情打开日志
    // log: ["query", "error", "warn"]
    });
if (process.env.NODE_ENV !== "production")
    global.prisma = prisma;
