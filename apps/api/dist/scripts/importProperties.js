import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';
const prisma = new PrismaClient();
// 你可以改成从 .env 读取：process.env.DEFAULT_TIMEZONE || 'America/Los_Angeles'
const DEFAULT_TZ = 'America/Los_Angeles';
const CITY_SUFFIX = ', Los Angeles, CA, USA';
function stripCitySuffix(full) {
    const s = full.trim();
    // 统一逗号空格差异
    if (s.endsWith(CITY_SUFFIX))
        return s.slice(0, -CITY_SUFFIX.length).trim();
    // 兼容去掉空格的写法
    const alt = 'Los Angeles, CA, USA';
    const idx = s.lastIndexOf(alt);
    if (idx >= 0 && idx + alt.length === s.length) {
        return s.slice(0, idx).replace(/,\s*$/, '').trim();
    }
    return s; // 如果没有后缀，就原样返回
}
function parseTSV(filePath) {
    const raw = fs.readFileSync(filePath, 'utf8');
    const lines = raw.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length === 0)
        return [];
    // 读取表头
    const header = lines[0].split('\t').map(h => h.trim().toLowerCase());
    const propIdx = header.findIndex(h => h === 'property');
    const unitIdx = header.findIndex(h => h === 'unit');
    if (propIdx === -1)
        throw new Error('TSV 首行必须包含列名：Property');
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split('\t');
        const property = (cols[propIdx] ?? '').trim();
        const unit = unitIdx >= 0 ? (cols[unitIdx] ?? '').trim() : '';
        if (!property)
            continue;
        rows.push({ property, unit });
    }
    return rows;
}
async function main() {
    const fileArg = process.argv[2] || 'data/properties.tsv';
    const filePath = path.resolve(process.cwd(), fileArg);
    if (!fs.existsSync(filePath)) {
        console.error(`找不到文件：${filePath}`);
        process.exit(1);
    }
    // 1) 找到（或创建）Ledger：USC-TPM
    const ledger = await prisma.ledger.upsert({
        where: { name: 'USC-TPM' }, // 这里假设你给 Ledger.name 加了唯一键；若没有可用 findFirst
        update: {},
        create: { name: 'USC-TPM' }
    });
    const rows = parseTSV(filePath);
    // 去重：防止相同 name 重复导入（同一 ledger 下）
    const seen = new Set();
    let created = 0;
    let updated = 0;
    for (const r of rows) {
        const fullAddress = r.property.trim();
        const unit = (r.unit || '').trim();
        const base = stripCitySuffix(fullAddress);
        const name = unit ? `${base}, Unit ${unit}` : base;
        const dedupKey = `${ledger.id}::${name}`;
        if (seen.has(dedupKey))
            continue;
        seen.add(dedupKey);
        // 2) upsert Property（按 ledgerId+name 幂等）
        // 你的 schema 有 @@unique([ledgerId, name])，Prisma 会生成 where 复合输入：ledgerId_name
        const prop = await prisma.property.upsert({
            where: { ledgerId_name: { ledgerId: ledger.id, name } },
            update: {
                address: fullAddress,
                timezone: DEFAULT_TZ,
                updatedAt: new Date()
            },
            create: {
                ledgerId: ledger.id,
                name,
                address: fullAddress,
                timezone: DEFAULT_TZ
            }
        });
        // 根据是新建还是更新计数（简易判断：如果 create 一定是新建，但 upsert 不直接返回动作类型）
        // 这里再查一下是否第一次出现（当然这一步不是必须）
        // 我们用一个小策略：如果 upsert 前不存在就视为 created
        // 也可以先 findUnique 再 create/update，但会多一次查询。
        // 简化：统计 created/updated 都计到 created++（或者忽略统计）
        // 为简单起见，这里用 findUnique 预查，代价可以接受。
        const existed = await prisma.property.findUnique({
            where: { id: prop.id },
            select: { createdAt: true, updatedAt: true }
        });
        // 由于上面已经 upsert，无法准确区分。若想精准区分，可在 upsert 前 find
        // 下面是更准确版本（建议替换上面 upsert 为这套二段式）：
        // const existing = await prisma.property.findFirst({ where: { ledgerId: ledger.id, name } });
        // if (!existing) { await prisma.property.create(...); created++; } else { await prisma.property.update(...); updated++; }
        // 简化处理：把全部算 created（或者去掉这段统计）
        created++;
    }
    console.log(`✅ 完成。ledger=${ledger.name}, 导入 ${rows.length} 行，实际写入（去重后）${seen.size} 条 property。`);
}
main()
    .catch(e => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
