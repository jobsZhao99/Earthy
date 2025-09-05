import 'dotenv/config';
import { PrismaClient, Channel, BookingRecordStatus } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';
import { DateTime } from 'luxon';
import cliProgress from 'cli-progress';
import { postBookingAccruals } from '../services/posting.js'; // 路径按你的项目调整
import { prisma } from '../prisma.js'; // ← 用单例

// const prisma = new PrismaClient();

const CITY_SUFFIX = ', Los Angeles, CA, USA';
const TARGET_LEDGER_NAME = 'USC-TPM';
const LA_TZ = 'America/Los_Angeles';

// --- 工具：去掉城市后缀 ---
function stripCitySuffix(full: string): string {
  const s = (full || '').trim();
  if (!s) return s;
  if (s.endsWith(CITY_SUFFIX)) return s.slice(0, -CITY_SUFFIX.length).trim();
  const alt = 'Los Angeles, CA, USA';
  const idx = s.lastIndexOf(alt);
  if (idx >= 0 && idx + alt.length === s.length) {
    return s.slice(0, idx).replace(/,\s*$/, '').trim();
  }
  return s;
}

// --- 规范化 Unit：把 “RM1 / Unit 2 / whole unit / (空)” 统一 --- //
function normalizeUnit(u: string | undefined | null): string {
  if (!u) return '';
  let s = u.toString().trim();
  if (!s) return '';
  const lower = s.toLowerCase();
  if (/\bwhole\b/.test(lower)) return ''; // 整套 → 视为无 Unit
  // 去噪词
  s = s.replace(/[,]/g, ' ');
  s = s.replace(/\b(unit|rm|room)\b/gi, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  return s.toUpperCase();
}

// --- 解析货币为“分”（$1,388.00 -> 138800）---
function parseMoneyToCents(m: string | number | null | undefined): number | null {
  if (m == null) return null;
  if (typeof m === 'number') return Math.round(m * 100);
  const s = m.replace(/\$/g, '').replace(/,/g, '').trim();
  if (!s) return null;
  const f = Number(s);
  if (Number.isNaN(f)) return null;
  return Math.round(f * 100);
}

// --- 解析 LA 本地日期，给定默认时间（小时:分钟） ---
function parseLADateWithTime(dateStr: string, hour: number, minute: number): Date {
  // 输入类似 "2025-09-07"
  const dt = DateTime.fromISO(dateStr.trim(), { zone: LA_TZ }).set({ hour, minute, second: 0, millisecond: 0 });
  if (!dt.isValid) throw new Error(`Invalid date: ${dateStr}`);
  return dt.toJSDate();
}

// --- 简单判断渠道 ---
function detectChannel(confirmation: string | null | undefined): Channel {
  const s = (confirmation || '').toLowerCase();
  if (s.includes('leasing contract')) return Channel.LEASING_CONTRACT;
  // 你可在此扩展：
  // if (/^hm[A-Z0-9]/i.test(s)) return Channel.AIRBNB;
  return Channel.AIRBNB;
}

// --- 读取表格（TSV/CSV），表头至少包含这些列 ---
type Row = {
  property: string;
  unit?: string;
  room: string;
  name: string;
  moveIn: string;
  moveOut: string;
  confirmedDate?: string;
  confirmationCode?: string;
  netRate?: string;
  totalRent?: string;
  note?: string;
};

function parseTable(filePath: string): Row[] {
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return [];

  const sep = lines[0].includes('\t') ? '\t' : ',';
  const header = lines[0].split(sep).map(h => h.trim().toLowerCase());

  const idx = (name: string) => header.findIndex(h => h === name.toLowerCase());

  const pIdx = idx('property');
  const uIdx = idx('unit');
  const rIdx = idx('room');
  const nIdx = idx('name');
  const miIdx = idx('move in');
  const moIdx = idx('move out');
  const cdIdx = idx('confirmed date');
  const ccIdx = idx('confirmation code');
  const nrIdx = idx('net rate');
  const trIdx = idx('total rent');
  const noteIdx = idx('note');

  const required = { pIdx, rIdx, nIdx, miIdx, moIdx };
  for (const [k, v] of Object.entries(required)) {
    if (v === -1) throw new Error(`缺少必需列：${k.replace('Idx','').replace(/[A-Z]/g, m=>' '+m).trim()}（需要 Property, Room, Name, Move in, Move out）`);
  }

  const rows: Row[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(sep);
    const get = (i: number) => (i >= 0 ? (cols[i] ?? '').trim() : '');
    const property = get(pIdx);
    const unit = get(uIdx);
    const room = get(rIdx);
    const name = get(nIdx);
    const moveIn = get(miIdx);
    const moveOut = get(moIdx);

    if (!property || !room || !name || !moveIn || !moveOut) continue;

    rows.push({
      property,
      unit,
      room,
      name,
      moveIn,
      moveOut,
      confirmedDate: get(cdIdx),
      confirmationCode: get(ccIdx),
      netRate: get(nrIdx),
      totalRent: get(trIdx),
      note: get(noteIdx),
    });
  }
  return rows;
}

async function getLedgerId(): Promise<string> {
  let ledger = await prisma.ledger.findFirst({
    where: { name: TARGET_LEDGER_NAME },
    orderBy: { createdAt: 'asc' },
    select: { id: true }
  });
  if (!ledger) {
    ledger = await prisma.ledger.create({ data: { name: TARGET_LEDGER_NAME }, select: { id: true } });
  }
  return ledger.id;
}

async function ensureGuestByName(name: string) {
  // 不加唯一：精准匹配 first or create
  const existing = await prisma.guest.findFirst({ where: { name } });
  if (existing) return existing;
  return prisma.guest.create({ data: { name } });
}

async function main() {
  const fileArg = process.argv[2] || 'data/bookings.tsv';
  const filePath = path.resolve(process.cwd(), fileArg);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ 找不到文件：${filePath}`);
    process.exit(1);
  }

  const rows = parseTable(filePath);
  if (rows.length === 0) {
    console.log('没有可导入的行。');
    return;
  }

  const ledgerId = await getLedgerId();

  // 读完 rows 后初始化进度条
  const bar = new cliProgress.SingleBar(
    { format: '导入进度 |{bar}| {percentage}% | {value}/{total} | 成功:{ok} 跳过:{skip} 失败:{fail}' },
    cliProgress.Presets.shades_classic
  );
  let created = 0;
  let skippedNoRoom = 0;
  let errors = 0;

  bar.start(rows.length, 0, { ok: created, skip: skippedNoRoom, fail: errors });

  for (const row of rows) {
    try {
      const base = stripCitySuffix(row.property);
      const unitNorm = normalizeUnit(row.unit);
      const propertyName = unitNorm ? `${base}, Unit ${unitNorm}` : base;

      // 找 Property
      const property = await prisma.property.findFirst({
        where: { ledgerId, name: propertyName },
        select: { id: true }
      });
      if (!property) {
        console.warn(`⚠️ 未找到 Property: "${propertyName}"，跳过（源 property="${row.property}", unit="${row.unit}"）`);
        skippedNoRoom++;
        continue;
      }

      // 找 Room
      const label = row.room.trim();
      const room = await prisma.room.findFirst({
        where: { propertyId: property.id, label },
        select: { id: true }
      });
      if (!room) {
        console.warn(`⚠️ 未找到 Room: property="${propertyName}", room="${label}"，跳过`);
        skippedNoRoom++;
        continue;
      }

      // 找/建 Guest
      const guest = await ensureGuestByName(row.name.trim());

      // 解析本地日期（LA）
      const checkIn = parseLADateWithTime(row.moveIn, 15, 0);  // 默认 15:00
      const checkOut = parseLADateWithTime(row.moveOut, 11, 0); // 默认 11:00

      // 金额
      const payoutCents = parseMoneyToCents(row.netRate) ?? null;      // Host payout
      const guestTotalCents = parseMoneyToCents(row.totalRent) ?? null;

      // 渠道
      const channel = detectChannel(row.confirmationCode);

      // 备注
      const memoParts = [];
      if (row.note) memoParts.push(row.note);
      if (row.confirmedDate) memoParts.push(`Confirmed: ${row.confirmedDate}`);
      const memo = memoParts.join(' | ') || null;

      const createdBooking = await prisma.bookingRecord.create({
        data: {
          roomId: room.id,
          guestId: guest.id,
          checkIn,
          checkOut,
          channel,
          guestTotalCents,
          payoutCents,
          confirmationCode: row.confirmationCode || null,
          contractUrl: null,
          status: BookingRecordStatus.NEW,
          memo
        }
      });
      await postBookingAccruals(createdBooking.id);
      created++;
    } catch (e) {
      errors++;
      console.error('❌ 导入该行失败:', e);
    } finally {
      bar.increment({ ok: created, skip: skippedNoRoom, fail: errors });
    }

  }
  bar.stop();

  console.log(`✅ 完成。
  读取行数: ${rows.length}
  成功写入: ${created}
  无对应 property/room 跳过: ${skippedNoRoom}
  失败: ${errors}`);

}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
