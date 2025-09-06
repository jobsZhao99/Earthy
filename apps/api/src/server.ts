// src/server.ts
import express from "express";
import cors from "cors";
import { prisma } from "./prisma.js";
import { errorHandler } from "./middlewares/error.js";
import bookings from "./routes/bookings.js";
import posting from "./routes/posting.js";
import reports from "./routes/reports.js";
import ledgers from "./routes/ledgers.js";
import properties from "./routes/properties.js";
import rooms from "./routes/rooms.js";
import guests from "./routes/guests.js";
import journals from "./routes/journals.js";
import dotenv from "dotenv";
dotenv.config();

// 读取 & 清洗：去掉引号、尾部斜杠
function parseOrigins(raw: string) {
  return raw
    .split(/[,\s]+/)
    .map(s => s.trim())
    .map(s => s.replace(/^"|"$/g, ""))   // 去掉首尾引号
    .map(s => s.replace(/\/$/, ""))      // 去掉末尾斜杠
    .filter(Boolean);
}
const raw = process.env.CORS_ORIGINS || process.env.FRONTEND_ORIGIN || "";

const allowedOrigins = parseOrigins(raw);

// 开发环境自动加入本地
if (process.env.NODE_ENV !== "production") {
  if (!allowedOrigins.includes("http://localhost:5173")) {
    allowedOrigins.push("http://localhost:5173");
  }
}

const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "*";


app.use(cors({
  origin: (origin, callback) => {
    // 无 Origin（如 curl/健康检查）放行
    if (!origin) return callback(null, true);
    const clean = origin.replace(/\/$/, "");
    if (allowedOrigins.includes(clean)) return callback(null, true);
    return callback(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true,
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
  allowedHeaders: "Content-Type,Authorization"
}));

app.options("*", cors());


app.use(express.json());

app.get("/healthz", async (_req, res) => {
  try { await prisma.$queryRaw`SELECT 1`; res.json({ ok: true }); }
  catch (e) { res.status(500).json({ ok: false, error: String(e) }); }
});

app.use("/api/bookings", bookings);
app.use("/api/tasks", posting);
// app.use("/api/reports", reports);

app.use("/api/ledgers", ledgers);
app.use("/api/properties", properties);
app.use("/api/rooms", rooms);
app.use("/api/guests", guests);
app.use("/api/journals", journals);

app.use(errorHandler);
app.listen(PORT, () => console.log(`API listening on :${PORT}`));
