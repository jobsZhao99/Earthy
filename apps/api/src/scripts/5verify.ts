// import 'dotenv/config';
// import { PrismaClient, BookingRecordType } from '@prisma/client';
// import fs from 'fs';
// import path from 'path';
// import { DateTime } from 'luxon';

// const prisma = new PrismaClient();

// // ——— 工具：把金额字符串转成“分”
// function parseMoneyToCents(s: string): number {
//   const n = parseFloat((s || '').replace(/[$,]/g, ''));
//   return Number.isFinite(n) ? Math.round(n * 100) : 0;
// }

// // ——— 工具：把 TSV 的 Type 映射到枚举
// function mapTypeToEnum(raw?: string): BookingRecordType | null {
//   if (!raw) return null;
//   const s = raw.trim().toUpperCase();
//   if (s === 'NEW') return BookingRecordType.NEW;
//   if (s === 'UPDATE') return BookingRecordType.UPDATE;
//   if (s === 'CANCEL' || s === 'CANCELLED') return BookingRecordType.CANCEL;
//   if (s === 'EXTEND' || s === 'EXTENDED') return BookingRecordType.EXTEND;
//   if (s === 'SHORTEN') return BookingRecordType.SHORTEN;
//   if (s === 'TRANSFER OUT' || s === 'TRANSFER_OUT') return BookingRecordType.TRANSFER_OUT;
//   if (s === 'TRANSFER IN' || s === 'TRANSFER_IN') return BookingRecordType.TRANSFER_IN;
//   return null; // 未识别时不做 type 过滤
// }

// // ——— 解析 TSV：逐行
// type Row = {
//   line: number;
//   confirmationCode: string;
//   moveInISO: string;
//   moveOutISO: string;
//   netRateCents: number;      // TSV: Net Rate (payout)
//   typeEnum: BookingRecordType | null; // 映射后的枚举
//   rawType: string;
// };

// function parseTsv(filePath: string): Row[] {
//   const raw = fs.readFileSync(filePath, 'utf8');
//   const lines = raw.split(/\r?\n/).filter(l => l.trim().length > 0);
//   if (!lines.length) return [];

//   const sep = lines[0].includes('\t') ? '\t' : ',';
//   const header = lines[0].split(sep).map(h => h.trim().toLowerCase());
//   const idx = (name: string) => header.findIndex(h => h === name.toLowerCase());

//   const ccIdx = idx('confirmation code');
//   const miIdx = idx('move in');
//   const moIdx = idx('move out');
//   const nrIdx = idx('net rate');
//   const typeIdx = idx('type');

//   if (ccIdx < 0 || miIdx < 0 || moIdx < 0 || nrIdx < 0) {
//     throw new Error('TSV 缺少必要列：Confirmation Code / Move In / Move Out / Net Rate');
//   }

//   const rows: Row[] = [];
//   for (let i = 1; i < lines.length; i++) {
//     const cols = lines[i].split(sep);
//     const get = (j: number) => (j >= 0 ? (cols[j] ?? '').trim() : '');

//     const confirmationCode = get(ccIdx);
//     const moveInISO = get(miIdx);
//     const moveOutISO = get(moIdx);
//     if (!confirmationCode || !moveInISO || !moveOutISO) continue;

//     const netRateCents = parseMoneyToCents(get(nrIdx));
//     const rawType = typeIdx >= 0 ? get(typeIdx) : '';
//     const typeEnum = mapTypeToEnum(rawType);

//     rows.push({
//       line: i + 1,
//       confirmationCode,
//       moveInISO,
//       moveOutISO,
//       netRateCents,
//       typeEnum,
//       rawType,
//     });
//   }
//   return rows;
// }

// // ——— 把 ISO 字符串的本日 UTC 00:00 / 次日 UTC 00:00 生成出来，用于“当日区间”匹配
// function dayRangeUTC(iso: string) {
//   const d0 = DateTime.fromISO(iso, { zone: 'utc' }).startOf('day');
//   const d1 = d0.plus({ days: 1 });
//   return { gte: d0.toJSDate(), lt: d1.toJSDate() };
// }

// async function main() {
//   const fileArg = process.argv[2] || 'data/all.tsv';
//   const filePath = path.resolve(process.cwd(), fileArg);
//   const rows = parseTsv(filePath);

//   console.log(`▶ Checking ${rows.length} TSV rows (strict line-by-line)…`);

//   let ok = 0, mismatch = 0, notFound = 0, dup = 0, typeMismatch = 0;

//   for (const r of rows) {
//     // 以 UTC 的“日期范围”来匹配，避免时区/毫秒误差
//     const startRange = dayRangeUTC(r.moveInISO);
//     const endRange   = dayRangeUTC(r.moveOutISO);

//     // 先查出所有候选（同 extRef 且 start/end 落在对应当日）
//     const candidates = await prisma.bookingRecord.findMany({
//       where: {
//         booking: { externalRef: r.confirmationCode },
//         rangeStart: { gte: startRange.gte, lt: startRange.lt },
//         rangeEnd:   { gte: endRange.gte,   lt: endRange.lt },
//         ...(r.typeEnum ? { type: r.typeEnum } : {}), // 有类型就一并过滤
//       },
//       include: {
//         journalLines: true,
//         booking: { select: { externalRef: true } },
//       },
//     });

//     if (candidates.length === 0) {
//       notFound++;
//       console.error(
//         `❌ [Line ${r.line}] Not found: code=${r.confirmationCode}, start=${r.moveInISO}, end=${r.moveOutISO}` +
//         (r.rawType ? `, type=${r.rawType}` : '')
//       );
//       continue;
//     }

//     if (candidates.length > 1) {
//       dup++;
//       console.error(
//         `❌ [Line ${r.line}] Multiple records matched (${candidates.length}): code=${r.confirmationCode}, start=${r.moveInISO}, end=${r.moveOutISO}` +
//         (r.rawType ? `, type=${r.rawType}` : '')
//       );
//       continue;
//     }

//     const rec = candidates[0];

//     // 如未通过 where 用 type 过滤（因为 TSV 没给或未识别），这里再做一次“提示性”校验
//     if (r.typeEnum && rec.type !== r.typeEnum) {
//       typeMismatch++;
//       console.warn(
//         `⚠️ [Line ${r.line}] TYPE mismatch: TSV=${r.typeEnum} (${r.rawType}), DB=${rec.type}`
//       );
//       // 不 return，继续比对金额
//     }

//     // 汇总该记录的 journalLines 金额（你也可以只算某些科目）
//     const sum = rec.journalLines.reduce((s, jl) => s + jl.amountCents, 0);

//     if (sum !== r.netRateCents) {
//       mismatch++;
//       console.warn(
//         `⚠️ [Line ${r.line}] AMOUNT mismatch: code=${r.confirmationCode}, TSV payout=${r.netRateCents}, DB sum=${sum}, diff=${sum - r.netRateCents}`
//       );
//     } else {
//       ok++;
//       // console.log(`✅ [Line ${r.line}] OK: ${r.confirmationCode} payout ${(sum/100).toFixed(2)}`);
//     }
//   }

//   console.log(
//     `\n🎯 Result: OK=${ok}, MISMATCH=${mismatch}, TYPE_MISMATCH=${typeMismatch}, NOT_FOUND=${notFound}, DUPLICATE=${dup}`
//   );
// }

// main()
//   .catch(e => {
//     console.error('❌ Script crashed:', e);
//     process.exit(1);
//   })
//   .finally(async () => {
//     await prisma.$disconnect();
//   });



import 'dotenv/config';
import { PrismaClient, BookingRecordType } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { DateTime } from 'luxon';

const prisma = new PrismaClient();

// ——— 工具：金额转分
function parseMoneyToCents(s: string): number {
  const n = parseFloat((s || '').replace(/[$,]/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

// ——— 工具：Type 映射
function mapTypeToEnum(raw?: string): BookingRecordType | null {
  if (!raw) return null;
  const s = raw.trim().toUpperCase();
  if (s === 'NEW') return BookingRecordType.NEW;
  if (s === 'UPDATE') return BookingRecordType.UPDATE;
  if (s === 'CANCEL' || s === 'CANCELLED') return BookingRecordType.CANCEL;
  if (s === 'EXTEND' || s === 'EXTENDED') return BookingRecordType.EXTEND;
  if (s === 'SHORTEN') return BookingRecordType.SHORTEN;
  if (s === 'TRANSFER OUT' || s === 'TRANSFER_OUT') return BookingRecordType.TRANSFER_OUT;
  if (s === 'TRANSFER IN' || s === 'TRANSFER_IN') return BookingRecordType.TRANSFER_IN;
  return null;
}

// ——— 工具：把 "June 2024" 这种列名转 YYYY-MM-01
function parseMonthHeader(label: string): string | null {
  const dt = DateTime.fromFormat(label.trim(), 'LLLL yyyy', { zone: 'utc' });
  return dt.isValid ? dt.startOf('month').toISODate() : null;
}

// ——— TSV Row 类型
type Row = {
  line: number;
  confirmationCode: string;
  moveInISO: string;
  moveOutISO: string;
  netRateCents: number;
  typeEnum: BookingRecordType | null;
  rawType: string;
  monthly: Map<string, number>; // 月份→金额(分)
};

// ——— 解析 TSV
function parseTsv(filePath: string): Row[] {
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (!lines.length) return [];

  const sep = lines[0].includes('\t') ? '\t' : ',';
  const header = lines[0].split(sep).map(h => h.trim());
  const idx = (name: string) => header.findIndex(h => h.toLowerCase() === name.toLowerCase());

  const ccIdx = idx('confirmation code');
  const miIdx = idx('move in');
  const moIdx = idx('move out');
  const nrIdx = idx('net rate');
  const typeIdx = idx('type');

  // 找出所有月份列
  const monthCols: { col: number; key: string }[] = [];
  header.forEach((h, i) => {
    const k = parseMonthHeader(h);
    console.log(`[DEBUG] header[${i}] = "${h}" →`, k);

    if (k) monthCols.push({ col: i, key: k });
  });

  console.log("所有月份列:", monthCols);

  const rows: Row[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(sep);
    const get = (j: number) => (j >= 0 ? (cols[j] ?? '').trim() : '');

    const confirmationCode = get(ccIdx);
    const moveInISO = get(miIdx);
    const moveOutISO = get(moIdx);
    if (!confirmationCode || !moveInISO || !moveOutISO) continue;

    const netRateCents = parseMoneyToCents(get(nrIdx));
    const rawType = typeIdx >= 0 ? get(typeIdx) : '';
    const typeEnum = mapTypeToEnum(rawType);

    // 解析逐月金额
    const monthly = new Map<string, number>();
    for (const { col, key } of monthCols) {
      const cents = parseMoneyToCents(get(col));
      if (cents !== 0) monthly.set(key, cents);
    }

    rows.push({
      line: i + 1,
      confirmationCode,
      moveInISO,
      moveOutISO,
      netRateCents,
      typeEnum,
      rawType,
      monthly,
    });
  }
  return rows;
}

// ——— 用于匹配日期：生成 [gte, lt) 范围
function dayRangeUTC(iso: string) {
  const d0 = DateTime.fromISO(iso, { zone: 'utc' }).startOf('day');
  const d1 = d0.plus({ days: 1 });
  return { gte: d0.toJSDate(), lt: d1.toJSDate() };
}

async function main() {
  const fileArg = process.argv[2] || 'data/all.tsv';
  const filePath = path.resolve(process.cwd(), fileArg);
  const rows = parseTsv(filePath);

  console.log(`▶ Checking ${rows.length} TSV rows...`);

  let ok = 0, mismatch = 0, monthlyMismatch = 0, notFound = 0, dup = 0, typeMismatch = 0;

  for (const r of rows) {
    const startRange = dayRangeUTC(r.moveInISO);
    const endRange   = dayRangeUTC(r.moveOutISO);

    const candidates = await prisma.bookingRecord.findMany({
      where: {
        booking: { externalRef: r.confirmationCode },
        rangeStart: { gte: startRange.gte, lt: startRange.lt },
        rangeEnd:   { gte: endRange.gte,   lt: endRange.lt },
        ...(r.typeEnum ? { type: r.typeEnum } : {}),
      },
      include: {
        journalLines: { include: { journal: true } },
        booking: { select: { externalRef: true } },
      },
    });

    if (candidates.length === 0) {
      notFound++;
      console.error(`❌ [Line ${r.line}] Not found: code=${r.confirmationCode}`);
      continue;
    }
    if (candidates.length > 1) {
      dup++;
      console.error(`❌ [Line ${r.line}] Duplicate records: code=${r.confirmationCode}`);
      continue;
    }

    const rec = candidates[0];

    if (r.typeEnum && rec.type !== r.typeEnum) {
      typeMismatch++;
      console.warn(`⚠️ [Line ${r.line}] TYPE mismatch: TSV=${r.typeEnum}, DB=${rec.type}`);
    }

    // DB 金额汇总
    const sum = rec.journalLines.reduce((s, jl) => s + jl.amountCents, 0);

    // 总金额对比
    if (sum !== r.netRateCents) {
      mismatch++;
      console.warn(`⚠️ [Line ${r.line}] TOTAL mismatch: TSV=${r.netRateCents}, DB=${sum}`);
    }

    // 逐月金额对比
    const dbMonthly = new Map<string, number>();
    for (const jl of rec.journalLines) {
      const key = DateTime.fromJSDate(jl.journal.periodMonth).toISODate(); // YYYY-MM-01
      dbMonthly.set(key, (dbMonthly.get(key) ?? 0) + jl.amountCents);
    }

    for (const [month, tsvVal] of r.monthly) {
      const dbVal = dbMonthly.get(month) ?? 0;
      if (tsvVal !== dbVal && Math.abs((tsvVal-dbVal)/tsvVal) > 0.01) { // 允许 1% 误差
        monthlyMismatch++;
        console.warn(`⚠️ [Line ${r.line}] MONTH mismatch: ${month}, TSV=${tsvVal}, DB=${dbVal}`);
      }
    }

    for (const [month, dbVal] of dbMonthly) {
      if (!r.monthly.has(month) && dbVal !== 0) {
        monthlyMismatch++;
        console.warn(`⚠️ [Line ${r.line}] Extra month in DB: ${month}, DB=${dbVal},Guest Name is ${rec.booking.externalRef}` );
      }
    }

    ok++;
  }

  console.log(
    `\n🎯 Result: OK=${ok}, TOTAL_MISMATCH=${mismatch}, MONTHLY_MISMATCH=${monthlyMismatch}, TYPE_MISMATCH=${typeMismatch}, NOT_FOUND=${notFound}, DUPLICATE=${dup}`
  );
}

main()
  .catch(e => {
    console.error('❌ Script crashed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
