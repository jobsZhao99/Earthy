import { PrismaClient, BookingRecordType } from "@prisma/client";
const prisma = new PrismaClient();

/**
 * 根据 bookingId 重新计算 booking 的 checkIn、checkOut、金额
 */
export async function recalcBooking(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { bookingRecords: true },
  });
  if (!booking) return;

  if (booking.bookingRecords.length === 0) return;

  // 按 createdAt 排序
  const records = [...booking.bookingRecords].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  );

  const first = records[0];
  let checkIn = first.rangeStart ?? booking.checkIn;
  let checkOut = first.rangeEnd ?? booking.checkOut;
  let guestTotal = first.guestDeltaCents ?? 0;
  let payoutTotal = first.payoutDeltaCents ?? 0;

  for (let i = 1; i < records.length; i++) {
    const r = records[i];
    if (r.type === BookingRecordType.EXTEND || r.type === BookingRecordType.NEW) {
      if (r.rangeStart && r.rangeStart < checkIn) {
        checkIn = r.rangeStart;
      }
      if (r.rangeEnd && r.rangeEnd > checkOut) {
        checkOut = r.rangeEnd;
      }
      guestTotal += r.guestDeltaCents ?? 0;
      payoutTotal += r.payoutDeltaCents ?? 0;
    } else if (r.type === BookingRecordType.CANCEL) {
      if (r.rangeStart && r.rangeEnd) {
        if (r.rangeStart >= checkIn && r.rangeEnd >= checkOut) {
          if (r.rangeStart < checkOut) {
            checkOut = r.rangeStart;
          }
        } else if (r.rangeStart <= checkIn && r.rangeEnd <= checkOut) {
          if (r.rangeEnd > checkIn) {
            checkIn = r.rangeEnd;
          }
        }
      }
      guestTotal += r.guestDeltaCents ?? 0;
      payoutTotal += r.payoutDeltaCents ?? 0;
    }
  }

  await prisma.booking.update({
    where: { id: booking.id },
    data: {
      checkIn,
      checkOut,
      guestTotalCents: guestTotal,
      payoutCents: payoutTotal,
    },
  });
}
