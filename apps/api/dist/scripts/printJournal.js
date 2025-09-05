import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';
import { stringify } from 'csv-stringify/sync';
// Excel 可选支持
let XLSX = null;
try {
    XLSX = require('xlsx');
}
catch { }
const prisma = new PrismaClient();
function ym(d) {
    // periodMonth 是 UTC 月初；显示成 YYYY-MM
    const y = d.getUTCFullYear();
    const m = (d.getUTCMonth() + 1).toString().padStart(2, '0');
    return `${y}-${m}`;
}
function parseArgs() {
    const a = {};
    for (const arg of process.argv.slice(2)) {
        const [k, v] = arg.split('=');
        if (!k)
            continue;
        const key = k.replace(/^--/, '');
        if (['from', 'to', 'ledger', 'ledgerId', 'out', 'fmt'].includes(key)) {
            a[key] = v;
        }
    }
    return a;
}
async function resolveLedger(ledger, ledgerId) {
    if (ledgerId)
        return { id: ledgerId, name: null };
    if (!ledger)
        return null;
    const row = await prisma.ledger.findFirst({ where: { name: ledger }, select: { id: true, name: true } });
    if (!row)
        throw new Error(`找不到 Ledger 名称：${ledger}`);
    return { id: row.id, name: row.name };
}
function monthStartUTC(ymStr) {
    const [y, m] = ymStr.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, 1));
}
function nextMonthUTC(d) {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
}
async function main() {
    const args = parseArgs();
    const outFile = args.out || `journal-monthly.${args.fmt === 'xlsx' ? 'xlsx' : 'csv'}`;
    // 过滤：ledger
    const ledgerFilter = await resolveLedger(args.ledger, args.ledgerId);
    // 先把所有 JournalEntry（按范围/账簿过滤）查出来
    const whereEntry = {};
    if (ledgerFilter)
        whereEntry.ledgerId = ledgerFilter.id;
    if (args.from) {
        const fromUTC = monthStartUTC(args.from);
        whereEntry.periodMonth = Object.assign(whereEntry.periodMonth ?? {}, { gte: fromUTC });
    }
    if (args.to) {
        const toUTC = monthStartUTC(args.to);
        const endUTC = nextMonthUTC(toUTC);
        whereEntry.periodMonth = Object.assign(whereEntry.periodMonth ?? {}, { lt: endUTC });
    }
    const entries = await prisma.journalEntry.findMany({
        where: whereEntry,
        select: { id: true, periodMonth: true, ledgerId: true, ledger: { select: { name: true } } },
        orderBy: [{ periodMonth: 'asc' }, { createdAt: 'asc' }]
    });
    if (entries.length === 0) {
        console.log('没有符合条件的 JournalEntry。');
        return;
    }
    // 对应每个 entry 求 sum(amountCents)
    // 用 groupBy 一次性聚合
    const sums = await prisma.journalLine.groupBy({
        by: ['journalId'],
        where: { journalId: { in: entries.map(e => e.id) } },
        _sum: { amountCents: true }
    });
    const sumMap = new Map(sums.map(s => [s.journalId, s._sum.amountCents ?? 0]));
    // 组装导出记录
    const records = entries.map(e => {
        const totalCents = sumMap.get(e.id) ?? 0;
        return {
            ledgerName: e.ledger?.name || '',
            ledgerId: e.ledgerId,
            periodMonth: ym(e.periodMonth),
            entryId: e.id,
            totalAmountCents: totalCents,
            totalAmountUSD: (totalCents / 100).toFixed(2)
        };
    });
    // 写出
    const absPath = path.resolve(process.cwd(), outFile);
    if (args.fmt === 'xlsx') {
        if (!XLSX)
            throw new Error('未安装 xlsx，请运行: npm i -D xlsx');
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(records);
        XLSX.utils.book_append_sheet(wb, ws, 'Journal Monthly');
        XLSX.writeFile(wb, absPath);
    }
    else {
        const csv = stringify(records, { header: true });
        fs.writeFileSync(absPath, csv);
    }
    console.log(`✅ 已导出 ${records.length} 行 -> ${absPath}`);
}
main()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(async () => { await prisma.$disconnect(); });
