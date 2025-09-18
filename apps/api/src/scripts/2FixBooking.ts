import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const bookings = await prisma.booking.findMany({
    include: { bookingRecords: true },
  });

  console.log(`共 ${bookings.length} 条 booking，开始处理…`);

  let ok = 0, skip = 0;

  for (const b of bookings) {
    if (!b.bookingRecords.length) {
      skip++;
      continue;
    }

    // 找最早 rangeStart / 最晚 rangeEnd
    const starts = b.bookingRecords
      .map((r) => r.rangeStart)
      .filter((d): d is Date => d != null);
    const ends = b.bookingRecords
      .map((r) => r.rangeEnd)
      .filter((d): d is Date => d != null);

    const checkIn = starts.length ? new Date(Math.min(...starts.map((d) => d.getTime()))) : b.checkIn;
    const checkOut = ends.length ? new Date(Math.max(...ends.map((d) => d.getTime()))) : b.checkOut;

    // 累加金额
    const guestTotal = b.bookingRecords.reduce((sum, r) => sum + (r.guestDeltaCents ?? 0), 0);
    const payoutTotal = b.bookingRecords.reduce((sum, r) => sum + (r.payoutDeltaCents ?? 0), 0);

    await prisma.booking.update({
      where: { id: b.id },
      data: {
        checkIn,
        checkOut,
        guestTotalCents: guestTotal,
        payoutCents: payoutTotal,
      },
    });

    ok++;
  }

  console.log(`✅ 完成: ${ok} 更新, ${skip} 跳过 (无 records)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
