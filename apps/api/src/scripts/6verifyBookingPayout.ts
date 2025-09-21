// scripts/checkBookingPayout.ts
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { DateTime } from 'luxon';

const prisma = new PrismaClient();

async function main() {
  console.log('▶ Start checking booking payout vs journal totals…');

  const bookings = await prisma.booking.findMany({
    include: {
      bookingRecords: {
        include: { journalLines: true },
      },
    },
  });

  let mismatchCount = 0;

  for (const b of bookings) {
    // 计算所有 journalLine 的总和
    const journalTotal = b.bookingRecords.reduce((sum, r) => {
      return sum + r.journalLines.reduce((s, jl) => s + (jl.amountCents ?? 0), 0);
    }, 0);

    const payout = b.payoutCents ?? 0;

    if (journalTotal !== payout) {
      mismatchCount++;
      console.log(
        `❌ Booking externalRef=${b.externalRef ?? 'N/A'}, ` +
        `checkIn=${DateTime.fromJSDate(b.checkIn).toISODate()}, ` +
        `checkOut=${DateTime.fromJSDate(b.checkOut).toISODate()}, ` +
        `payoutCents=${payout}, journalTotal=${journalTotal}`
      );
    }
  }

  console.log(`\n🎯 Done. Found ${mismatchCount} mismatched bookings.`);
}

main()
  .catch((e) => {
    console.error('❌ Script crashed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
