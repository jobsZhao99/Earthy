import { PrismaClient, BookingStatus } from '@prisma/client';
import { DateTime } from 'luxon';

const prisma = new PrismaClient();

async function main() {
  const today = DateTime.now().startOf('day'); // 当天 0点

  console.log("Updating booking statuses for", today.toISODate());

  // 1. 已退房：checkOut < today
  await prisma.booking.updateMany({
    where: {
      checkOut: { lt: today.toJSDate() },
    },
    data: { status: BookingStatus.CHECKED_OUT },
  });

  // 2. 已入住：checkIn ≤ today < checkOut
  await prisma.booking.updateMany({
    where: {
      checkIn: { lte: today.toJSDate() },
      checkOut: { gt: today.toJSDate() },
    },
    data: { status: BookingStatus.CHECKED_IN },
  });

  // 3. 已预订未入住：checkIn > today
  await prisma.booking.updateMany({
    where: {
      checkIn: { gt: today.toJSDate() },
    },
    data: { status: BookingStatus.CONFIRMED },
  });

  console.log("✅ Booking status update complete.");
}

main()
  .catch((e) => {
    console.error("❌ Error updating booking statuses:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
