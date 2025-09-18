// scripts/clearBookings.ts
import { prisma } from "../prisma.js";

async function main() {
  console.log("Deleting BookingRecords...");
  await prisma.bookingRecord.deleteMany({});

  console.log("Deleting Bookings...");
  await prisma.booking.deleteMany({});

  console.log("Deleting Rooms...");
  await prisma.room.deleteMany({});

  console.log("Deleting Properties...");
  await prisma.property.deleteMany({});

  console.log("Deleting Guest...");
  await prisma.guest.deleteMany({});
  console.log("Done!");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
