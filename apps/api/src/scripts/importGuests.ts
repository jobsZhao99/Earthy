import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';

const prisma = new PrismaClient();

function normalizeName(s: string) {
  // 去首尾空白、把多个空格合一（保留原有非 ASCII 字符）
  return s.replace(/\s+/g, ' ').trim();
}

function readNames(filePath: string): string[] {
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  // 如果第一行看起来是表头（包含 “name” 不区分大小写），就丢掉
  const header = lines[0].toLowerCase();
  const body = header.includes('name') ? lines.slice(1) : lines;

  // 支持：一行一个名字；或一行多列（用逗号/制表分隔，取第一列）
  const names = body.map(line => {
    const cell = line.split(/\t|,/)[0] ?? '';
    return normalizeName(cell);
  }).filter(Boolean);

  // 本次导入去重（不查库，只对输入去重）
  return Array.from(new Set(names));
}

// 简单分批，避免一次 createMany 太大
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main() {
  const fileArg = process.argv[2] || 'data/guests.tsv';
  const filePath = path.resolve(process.cwd(), fileArg);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ 找不到文件：${filePath}`);
    process.exit(1);
  }

  const names = readNames(filePath);
  if (names.length === 0) {
    console.log('没有可导入的名字。');
    return;
  }

  console.log(`读取到 ${names.length} 个去重后的名字，开始导入…`);

  // 如果你担心数据库里早已有重名，可先读出已存在的名字过滤一遍：
  // const existing = await prisma.guest.findMany({ select: { name: true }});
  // const existingSet = new Set(existing.map(g => normalizeName(g.name)));
  // const finalNames = names.filter(n => !existingSet.has(n));

  const batches = chunk(names, 500);
  let inserted = 0;

  for (const group of batches) {
    // createMany 快速导入；你的 Guest.name 没有唯一键，所以先在输入侧去重即可
    const data = group.map(n => ({ name: n }));
    const result = await prisma.guest.createMany({
      data,
      skipDuplicates: false // 没有唯一约束，这里设 true/false 都不会影响库内已存在的重名
    });
    inserted += result.count;
    console.log(`  + 批量插入 ${result.count} 条（累计 ${inserted}/${names.length}）`);
  }

  console.log(`✅ 完成：共准备 ${names.length} 条，本次成功插入 ${inserted} 条。`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
