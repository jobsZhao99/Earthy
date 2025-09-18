import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_CHANNELS = [
  { label: 'Airbnb' },
  { label: 'Booking.com' },
  { label: 'Vrbo' },
  { label: 'Leasing Contract' },
];

async function main() {
  console.log('🔄 初始化 Channel 表…');

  for (const c of DEFAULT_CHANNELS) {
    await prisma.channel.upsert({
      where: { label: c.label },
      update: {},
      create: c,
    });
    console.log(`✅ 确保存在渠道: ${c.label}`);
  }

  console.log('🎉 Channel 初始化完成');
}

main()
  .catch(e => {
    console.error('❌ 出错:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
