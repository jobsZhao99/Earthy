import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    console.log('⚠️ 即将删除所有 JournalLine 和 BookingRecord 数据，请确认已备份！');
    // 先删 JournalLine（依赖 BookingRecord / JournalEntry）
    const jl = await prisma.journalLine.deleteMany({});
    console.log(`🗑️ 删除 JournalLine: ${jl.count} 行`);
    // 再删 BookingRecord
    const br = await prisma.bookingRecord.deleteMany({});
    console.log(`🗑️ 删除 BookingRecord: ${br.count} 行`);
    console.log('✅ 清理完成');
}
main()
    .catch(e => { console.error('❌ 出错:', e); process.exit(1); })
    .finally(async () => { await prisma.$disconnect(); });
