import { PrismaClient, BookingStatus } from '@prisma/client';
import { DateTime } from 'luxon';

const prisma = new PrismaClient();

async function main() {
  const today = DateTime.now().startOf('day'); // 当天 0点
  const tomorrow = today.plus({ days: 1 });

  console.log("Updating booking statuses for", today.toISODate());

  // 1. checkout < today → CHECKED_OUT
  await prisma.bookingRecord.updateMany({
    where: {
      checkOut: { lt: today.toJSDate() },
    },
    data: { status: BookingStatus.CHECKED_OUT },
  });

  // 2. checkIn = today → FUTURE
  await prisma.bookingRecord.updateMany({
    where: {
      checkIn: {
        gte: today.toJSDate(),
        lt: tomorrow.toJSDate(),
      },
    },
    data: { status: BookingStatus.FUTURE },
  });

  // 3. checkOut = today → CHECKED_IN
  await prisma.bookingRecord.updateMany({
    where: {
      checkOut: {
        gte: today.toJSDate(),
        lt: tomorrow.toJSDate(),
      },
    },
    data: { status: BookingStatus.CHECKED_IN },
  });

  // 4. today 在 checkIn 和 checkOut 之间 → CHECKED_IN
  await prisma.bookingRecord.updateMany({
    where: {
      checkIn: { lte: today.toJSDate() },
      checkOut: { gt: today.toJSDate() },
    },
    data: { status: BookingStatus.CHECKED_IN },
  });

  // 5. checkIn > today → FUTURE
  await prisma.bookingRecord.updateMany({
    where: {
      checkIn: { gt: today.toJSDate() },
    },
    data: { status: BookingStatus.FUTURE },
  });

  console.log("Booking status update complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
