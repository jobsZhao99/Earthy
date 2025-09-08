// src/server.ts
import 'dotenv/config';
import express from 'express';
import cors, { type CorsOptions } from 'cors';
import helmet from 'helmet';
import { prisma } from './prisma.js';
import { errorHandler } from './middlewares/error.js';

// === 路由（存在哪个就解开哪个） ===
import bookings from './routes/bookings.js';
import posting from './routes/posting.js';
import properties from './routes/properties.js';
import reports from './routes/reports.js';
// import ledgers from './routes/ledgers.js';
// import rooms from './routes/rooms.js';
import guests from './routes/guests.js';
import todayBookings from './routes/today-bookings.js';
// import journals from './routes/journals.js';

// ------ CORS 允许来源（清洗环境变量中的引号和尾斜杠） ------
function parseOrigins(raw: string) {
  return raw
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .map((s) => s.replace(/^"|"$/g, '')) // 去掉首尾引号
    .map((s) => s.replace(/\/$/, '')) // 去掉末尾斜杠
    .filter(Boolean);
}

const rawCors = process.env.CORS_ORIGINS || process.env.FRONTEND_ORIGIN || '';
const allowedOrigins = parseOrigins(rawCors);

// 本地开发自动允许 Vite 默认端口
if (process.env.NODE_ENV !== 'production' && !allowedOrigins.includes('http://localhost:5173')) {
  allowedOrigins.push('http://localhost:5173');
}

console.log('[CORS] raw =', rawCors);
console.log('[CORS] allowedOrigins =', allowedOrigins);

const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // 没有 Origin（curl/健康检查）继续放行
    const clean = origin.replace(/^"|"$/g, '').replace(/\/$/, ''); // 去首尾引号 + 去尾斜杠
    if (allowedOrigins.includes(clean)) return callback(null, clean); // ← 返回“干净”的字符串
    return callback(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true,
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  allowedHeaders: 'Content-Type,Authorization',
  // 可选：确保预检继续走到你后面的 OPTIONS 兜底（不是必须）
  // preflightContinue: true,
};
const app = express();

// Render/反代下建议信任代理（获取正确的 req.ip/协议）
app.set('trust proxy', 1);

// 安全头（保持宽松，允许跨域）
app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);

// 解析 JSON / 表单
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// CORS（预检与业务一致）
app.use(cors(corsOptions));
// app.options('*', cors(corsOptions));

// 放在 app.use(cors(corsOptions)) 之后
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    const origin = req.headers.origin || '';
    const clean = String(origin).replace(/^"|"$/g, '').replace(/\/$/, '');
    if (allowedOrigins.includes(clean)) {
      res.setHeader('Access-Control-Allow-Origin', clean);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE');
      res.setHeader(
        'Access-Control-Allow-Headers',
        req.headers['access-control-request-headers'] || 'Content-Type,Authorization'
      );
    }
    return res.sendStatus(204);
  }
  next();
});


// 健康检查
app.get('/api/healthz', (_req, res) => res.json({ ok: true }));



// API 路由统一挂在 /api 前缀下
app.use('/api/bookings', bookings);
app.use('/api', todayBookings);

app.use('/api/tasks', posting);
app.use('/api/properties', properties);
app.use('/api/reports', reports);
// app.use('/api/ledgers', ledgers);
// app.use('/api/rooms', rooms);
app.use('/api/guests', guests);
// app.use('/api/journals', journals);

// 404 兜底（API）
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// 统一错误处理
app.use(errorHandler);

// 启动
const PORT = Number(process.env.PORT || 3000);
const server = app.listen(PORT, () => {
  console.log(`API listening on :${PORT}`);
});

// 优雅退出
async function shutdown(signal: string) {
  try {
    console.log(`[${signal}] shutting down...`);
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  } catch (e) {
    console.error('Shutdown error:', e);
    process.exit(1);
  }
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
