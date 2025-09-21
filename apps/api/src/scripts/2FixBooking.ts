import 'dotenv/config';
import { PrismaClient, BookingRecordType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const bookings = await prisma.booking.findMany({
    include: { bookingRecords: true },
  });

  console.log(`共 ${bookings.length} 条 booking，开始处理…`);

  let ok = 0, skip = 0, fail = 0;

  for (const b of bookings) {
    if (!b.bookingRecords.length) {
      skip++;
      continue;
    }

    // 按 createdAt 排序
    const records = [...b.bookingRecords].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    );

    const first = records[0];
    if (first.type == BookingRecordType.CANCEL) {
      console.error(`❌ Booking ${b.externalRef} 首条记录不是 NEW，而是 ${first.type}`);
      fail++;
      // continue;
    }

    // 初始 checkIn/out 来自 NEW record
    let checkIn = first.rangeStart ?? b.checkIn;
    let checkOut = first.rangeEnd ?? b.checkOut;
    let guestTotal = first.guestDeltaCents ?? 0;
    let payoutTotal = first.payoutDeltaCents ?? 0;

    // 遍历后续记录
    for (let i = 1; i < records.length; i++) {
      const r = records[i];

      if (r.type === BookingRecordType.EXTEND || r.type === BookingRecordType.NEW) {
        // payout 应该为正
        if ((r.payoutDeltaCents ?? 0) <= 0) {
          console.warn(`⚠️ BookingRecord ${r.id} EXTEND 的 payout <= 0`);
        }
        if (r.rangeStart && r.rangeStart < checkIn) {
          checkIn = r.rangeStart;
        }
        if (r.rangeEnd && r.rangeEnd > checkOut) {
          checkOut = r.rangeEnd;
        }
        guestTotal += r.guestDeltaCents ?? 0;
        payoutTotal += r.payoutDeltaCents ?? 0;
      } 
      else if (r.type === BookingRecordType.CANCEL) {
        // payout 应该为负
        if ((r.payoutDeltaCents ?? 0) >= 0) {
          console.warn(`⚠️ BookingRecord ${r.id} CANCEL 的 payout >= 0`);
        }

        if (r.rangeStart && r.rangeEnd) {
          // 如果 CANCEL 在尾部，缩短 checkout
          if (r.rangeStart >= checkIn && r.rangeEnd >= checkOut) {
            if (r.rangeStart < checkOut) {
              checkOut = r.rangeStart; // 提前到取消开始的那一天
            }
          }
          // 如果 CANCEL 在头部，推迟 checkin
          else if (r.rangeStart <= checkIn && r.rangeEnd <= checkOut) {
            if (r.rangeEnd > checkIn) {
              checkIn = r.rangeEnd; // 推迟到取消结束的那一天
            }
          }
          // 如果 cancel 在中间 → 暂时只计金额，不动区间
        }

        guestTotal += r.guestDeltaCents ?? 0;
        payoutTotal += r.payoutDeltaCents ?? 0;
      } 
      else {
        console.warn(`⚠️ BookingRecord ${b.externalRef} 类型 ${r.type} 未处理,check in ${r.rangeStart},${r.rangeEnd},${r.payoutDeltaCents*0.01}，跳过`);
      }
    }

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

  console.log(`\n🎯 处理完成: OK=${ok}, FAIL=${fail}, SKIP=${skip}`);
}

main()
  .catch((e) => {
    console.error('❌ Script crashed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
