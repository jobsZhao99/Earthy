import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';

const prisma = new PrismaClient();

const CITY_SUFFIX = ', Los Angeles, CA, USA';
const DEFAULT_TZ = process.env.DEFAULT_TIMEZONE || 'America/Los_Angeles';
const TARGET_LEDGER_NAME = 'USC-TPM';

// —— 工具：去掉城市后缀 —— //
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

// —— 规范化 Unit：把 “RM2、Unit Rm 2、2、whole unit、RMWhole Unit” 统一 —— //
function normalizeUnit(u: string | undefined | null): string {
  if (!u) return '';
  let s = u.toString().trim();
  if (!s) return '';

  const lower = s.toLowerCase();
  // 各种“整套”写法都当成无 Unit（归到 base 物业）
  if (/\bwhole\b/.test(lower)) return '';

  // 去掉常见噪音词
  s = s.replace(/[,]/g, ' ');
  s = s.replace(/\b(unit|rm|room)\b/gi, ' ');
  s = s.replace(/\s+/g, ' ').trim();

  // 规整成大写
  s = s.toUpperCase();

  // 如果剩下的是空，就表示“整套”
  return s;
}

// —— 规范化 Room 的 label（可按需增强；这里仅去多余空格） —— //
function normalizeRoomLabel(label: string | undefined | null): string {
  if (!label) return '';
  return label.replace(/\s+/g, ' ').trim();
}

// —— 解析 TSV/CSV（要求首行包含 Property/Unit/Room） —— //
type Row = { property: string; unit: string; room: string };

function parseTable(filePath: string): Row[] {
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return [];

  // 自动识别分隔符：优先 \t，其次 ,
  const sep = lines[0].includes('\t') ? '\t' : ',';
  const header = lines[0].split(sep).map(h => h.trim().toLowerCase());

  const pIdx = header.findIndex(h => h === 'property');
  const uIdx = header.findIndex(h => h === 'unit');
  const rIdx = header.findIndex(h => h === 'room');
  if (pIdx === -1 || rIdx === -1) {
    throw new Error('表头必须至少包含列：Property、Room（Unit 可为空）');
  }

  const rows: Row[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(sep);
    const property = (cols[pIdx] ?? '').trim();
    const unit = uIdx >= 0 ? (cols[uIdx] ?? '').trim() : '';
    const room = (cols[rIdx] ?? '').trim();
    if (!property || !room) continue; // 缺字段跳过
    rows.push({ property, unit, room });
  }
  return rows;
}

async function getLedger(): Promise<{ id: string; name: string }> {
  // Ledger.name 没有唯一约束，用 findFirst
  let ledger = await prisma.ledger.findFirst({
    where: { name: TARGET_LEDGER_NAME },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true }
  });
  if (!ledger) {
    // 如果没有就创建一条
    ledger = await prisma.ledger.create({
      data: { name: TARGET_LEDGER_NAME },
      select: { id: true, name: true }
    });
  } else {
    // 提醒是否有重名多条
    const dup = await prisma.ledger.count({ where: { name: TARGET_LEDGER_NAME } });
    if (dup > 1) {
      console.warn(`⚠️ 发现 ${dup} 条同名 Ledger('${TARGET_LEDGER_NAME}'), 使用 id=${ledger.id}。建议后续合并清理。`);
    }
  }
  return ledger;
}

async function main() {
  const fileArg = process.argv[2] || 'data/rooms.tsv'; // 你的表格路径
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

  const ledger = await getLedger();

  let created = 0;
  let updated = 0;
  let skippedNoProperty = 0;
  let dedup = 0;

  // 输入内去重：同一个 Property+Unit+Room 重复出现只处理一次
  const seen = new Set<string>();

  for (const row of rows) {
    const fullAddress = row.property.trim();
    const unitNorm = normalizeUnit(row.unit);
    const label = normalizeRoomLabel(row.room);
    if (!label) continue;

    const base = stripCitySuffix(fullAddress);
    const propertyName = unitNorm ? `${base}, Unit ${unitNorm}` : base;
    const key = `${propertyName}::${label}`;
    if (seen.has(key)) { dedup++; continue; }
    seen.add(key);

    // 找到对应 Property（按 ledgerId+name）
    const property = await prisma.property.findFirst({
      where: { ledgerId: ledger.id, name: propertyName },
      select: { id: true }
    });

    if (!property) {
      console.warn(`⚠️ 未找到 Property：name="${propertyName}"（源：${fullAddress} / unit="${row.unit}"），跳过该房间 "${label}"`);
      skippedNoProperty++;
      continue;
    }

    // 查是否已有相同 label 的 Room
    const existing = await prisma.room.findFirst({
      where: { propertyId: property.id, label },
      select: { id: true }
    });

    if (existing) {
      // 目前只做幂等跳过；如需更新 nightlyRateCents 等，这里写 update
      // await prisma.room.update({ where: { id: existing.id }, data: { nightlyRateCents: null } });
      updated++; // 计入“已存在/已更新”
    } else {
      await prisma.room.create({
        data: {
          propertyId: property.id,
          label,
          // nightlyRateCents: null, // 如需从文件导入价格可在表里加一列
        }
      });
      created++;
    }
  }

  console.log(`✅ 完成。
  总行数: ${rows.length}
  去重后处理: ${seen.size} 
  新建 rooms: ${created}
  已有/更新: ${updated}
  未找到 property 跳过: ${skippedNoProperty}
  输入内重复跳过: ${dedup}`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
