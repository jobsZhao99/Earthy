// src/server.ts
import express from "express";
import cors from "cors";
import { prisma } from "./prisma.js";
import { errorHandler } from "./middlewares/error.js";
import booking from "./routes/booking.js";
import posting from "./routes/posting.js";
import report from "./routes/report.js";
import ledger from "./routes/ledger.js";
import property from "./routes/property.js";
import room from "./routes/room.js";
import guest from "./routes/guest.js";
import journal from "./routes/journal.js";
import dotenv from "dotenv";
dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "*";
app.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }));
app.use(express.json());
app.get("/healthz", async (_req, res) => {
    try {
        await prisma.$queryRaw `SELECT 1`;
        res.json({ ok: true });
    }
    catch (e) {
        res.status(500).json({ ok: false, error: String(e) });
    }
});
app.use("/api/booking", booking);
app.use("/api/task", posting);
app.use("/api/report", report);
app.use("/api/ledger", ledger);
app.use("/api/property", property);
app.use("/api/room", room);
app.use("/api/guest", guest);
app.use("/api/journal", journal);
app.use(errorHandler);
app.listen(PORT, () => console.log(`API listening on :${PORT}`));
