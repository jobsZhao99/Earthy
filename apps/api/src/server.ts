// src/server.ts
import express from "express";
import cors from "cors";
import { prisma } from "./prisma.js";
import { errorHandler } from "./middlewares/error.js";
import bookings from "./routes/bookings.js";
import posting from "./routes/posting.js";
import reports from "./routes/reports.js";
import cleaning from "./routes/cleaning.js";
import ledgers from "./routes/ledgers.js";
import properties from "./routes/properties.js";
import rooms from "./routes/rooms.js";
import guests from "./routes/guests.js";
import journals from "./routes/journals.js";
import dotenv from "dotenv";
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "*";

app.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }));
app.use(express.json());

app.get("/healthz", async (_req, res) => {
  try { await prisma.$queryRaw`SELECT 1`; res.json({ ok: true }); }
  catch (e) { res.status(500).json({ ok: false, error: String(e) }); }
});

app.use("/api/bookings", bookings);
app.use("/api/tasks", posting);
app.use("/api/reports", reports);
app.use("/api/cleaning", cleaning);

app.use("/api/ledgers", ledgers);
app.use("/api/properties", properties);
app.use("/api/rooms", rooms);
app.use("/api/guests", guests);
app.use("/api/journals", journals);

app.use(errorHandler);
app.listen(PORT, () => console.log(`API listening on :${PORT}`));
