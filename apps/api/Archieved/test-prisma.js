// src/test-prisma.js
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log("=== Prisma Models 可用列表 ===");
  console.log(Object.keys(prisma).filter(k => typeof prisma[k] === 'object'));

  console.log("\n=== 测试查询 ===");
  try {
    // 测试 guest
    const guests = await prisma.guest.findMany({ take: 1 });
    console.log("Guest sample:", guests);

    // 测试 booking
    const bookings = await prisma.booking.findMany({ take: 1 });
    console.log("Booking sample:", bookings);

    // 测试 room
    const rooms = await prisma.room.findMany({ take: 1 });
    console.log("Room sample:", rooms);
  } catch (err) {
    console.error("查询出错:", err);
  }
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
