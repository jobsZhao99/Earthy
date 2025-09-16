// scripts/exportBookings.ts
import { PrismaClient } from '@prisma/client';
import fs from 'node:fs';
import { stringify } from 'csv-stringify/sync';

const prisma = new PrismaClient();

async function main() {
  const data = await prisma.bookingRecord.findMany({
    include: { guest: true, room: true },
  });

  // 挑选需要的字段
  const records = data.map(b => ({
    id: b.id,
    guest: b.guest?.name,
    room: b.room?.label,
    checkIn: b.checkIn.toISOString(),
    checkOut: b.checkOut.toISOString(),
    payoutCents: b.payoutCents,
    guestTotalCents: b.guestTotalCents,
    status: b.status,
  }));

  const csv = stringify(records, { header: true });
  fs.writeFileSync('bookings.csv', csv);
  console.log('✅ 已导出 bookings.csv');
}

main().finally(() => prisma.$disconnect());
