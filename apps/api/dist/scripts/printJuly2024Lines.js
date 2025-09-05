import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
function parseArgs() {
    const out = {};
    for (const a of process.argv.slice(2)) {
        const [k, v] = a.split('=');
        if (k?.startsWith('--') && v)
            out[k.slice(2)] = v;
    }
    return out;
}
function monthStartUTC(ym) {
    const [y, m] = ym.split('-').map(Number);
    if (!y || !m || m < 1 || m > 12) {
        throw new Error(`月份参数不合法：${ym}（应为 YYYY-MM）`);
    }
    return new Date(Date.UTC(y, m - 1, 1));
}
async function main() {
    const args = parseArgs();
    const month = args.month || '2024-07'; // 可通过 --month=YYYY-MM 覆盖
    const ledgerName = 'USC-TPM'; // 你的账簿名
    // 1) 找 USC-TPM 账簿
    const ledger = await prisma.ledger.findFirst({
        where: { name: ledgerName },
        select: { id: true, name: true },
    });
    if (!ledger)
        throw new Error(`找不到 Ledger: ${ledgerName}`);
    // 2) 该月的 UTC 月初（periodMonth）
    const periodMonth = monthStartUTC(month);
    // 3) 用复合唯一键查询（periodMonth + ledgerId）
    const entry = await prisma.journalEntry.findUnique({
        where: { periodMonth_ledgerId: { periodMonth, ledgerId: ledger.id } },
        include: {
            journalLines: {
                include: {
                    booking: {
                        include: {
                            guest: true,
                            room: { include: { property: true } },
                        },
                    },
                },
                orderBy: { createdAt: 'asc' },
            },
        },
    });
    if (!entry) {
        console.log(`账簿 "${ledger.name}" 在 ${month} 没有 JournalEntry。`);
        return;
    }
    const totalCents = entry.journalLines.reduce((s, l) => s + l.amountCents, 0);
    console.log(`Ledger: ${ledger.name}`);
    console.log(`PeriodMonth(UTC): ${entry.periodMonth.toISOString()}`);
    console.log(`Lines: ${entry.journalLines.length}, Total: ${totalCents} cents ($${(totalCents / 100).toFixed(2)})`);
    console.log('--- 明细 ---');
    for (const line of entry.journalLines) {
        const prop = line.booking?.room?.property?.name ?? '-';
        const room = line.booking?.room?.label ?? '-';
        const guest = line.booking?.guest?.name ?? '-';
        console.log(`${prop} | ${room} | ${guest} | ${line.account} | ${line.amountCents}`);
    }
}
main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(async () => { await prisma.$disconnect(); });
