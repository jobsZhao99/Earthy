import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config();
const app = express();
const prisma = new PrismaClient();

const PORT = process.env.PORT || 3000;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "*";

app.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }));
app.use(express.json());

app.get("/healthz", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, version: process.env.COMMIT_SHA || "dev" });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

/**
 * 示例：创建一个最小的 Booking（只含基本字段）
 * 你后续会扩展成包含 line items、allocation、journal 等
 */
app.post("/api/bookings", async (req, res) => {
  const { roomId, guestId, channel = "DIRECT", checkIn, checkOut } = req.body;
  const booking = await prisma.booking.create({
    data: { roomId, guestId, channel, checkIn: new Date(checkIn), checkOut: new Date(checkOut) }
  });
  res.json(booking);
});

/** 示例列表接口 */
app.get("/api/bookings", async (req, res) => {
  const list = await prisma.booking.findMany({ include: { room: true, guest: true } });
  res.json(list);
});

app.listen(PORT, () => {
  console.log(`API listening on :${PORT}`);
});
