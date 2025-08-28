// scripts/run_accrual_demo.js
// 运行：node scripts/run_accrual_demo.js
import { DateTime } from "luxon";

/** ====== 工具：按物业时区，把 UTC 的入住/退房切到各“本地自然月”的晚数 ====== */
function splitNightsByMonthWithTZ(checkInUTC, checkOutUTC, propertyTz) {
  const ci = DateTime.fromISO(checkInUTC, { zone: "utc" }).setZone(propertyTz).startOf("day");
  const co = DateTime.fromISO(checkOutUTC, { zone: "utc" }).setZone(propertyTz).startOf("day");
  if (co <= ci) return [];

  const res = [];
  let cur = ci;
  while (cur < co) {
    const nextMonthStart = cur.endOf("month").plus({ day: 1 }).startOf("day"); // 下月1号 00:00
    const next = nextMonthStart < co ? nextMonthStart : co;
    res.push({
      // 当地月初（DateTime）
      periodMonthLocal: cur.startOf("month"),
      // 这一段“晚数”= 自 cur 到 next 的天数
      nights: Math.floor(next.diff(cur, "days").days),
    });
    cur = next;
  }
  return res;
}

/** 把“当地月初”转为“UTC 月初 JS Date”（存库/展示统一用月初） */
function toUTCMonthStart(localMonthStart) {
  return localMonthStart.startOf("month").toUTC().toJSDate();
}

/** ====== 金额分摊：按天数，最后一个月+1天；两位小数；差额全入最后一个月 ====== */
function allocateByDaysLastPlusOneDecimal(total, chunks) {
  const toCents = (v) => {
    if (v == null || v === "") return 0;
    const n = typeof v === "object" ? Number(v.toString()) : Number(v);
    if (!Number.isFinite(n)) throw new Error("total 不是合法数字");
    return Math.round(n * 100); // 四舍五入到“分”
  };
  const centsToAmount = (c) => (c / 100).toFixed(2);

  if (!Array.isArray(chunks) || chunks.length === 0) return [];

  const totalCents = toCents(total);
  if (totalCents === 0) {
    return chunks.map((c) => ({ ...c, daysWeight: 0, cents: 0, amount: "0.00" }));
  }

  // 权重：用 nights，最后一个月 +1 天
  const weights = chunks.map((c) => Math.max(0, Number(c.nights) || 0));
  weights[weights.length - 1] += 1;

  const totalDays = weights.reduce((s, d) => s + d, 0);
  if (totalDays <= 0) {
    return chunks.map((c, i, arr) => {
      const cents = i === arr.length - 1 ? totalCents : 0;
      return { ...c, daysWeight: 0, cents, amount: centsToAmount(cents) };
    });
  }

  const exactCents = weights.map((w) => (totalCents * w) / totalDays);
  const rounded = exactCents.map((x) => Math.round(x)); // 四舍五入到“分”
  const assigned = rounded.reduce((s, v) => s + v, 0);
  const delta = totalCents - assigned; // 差额入最后一个月
  rounded[rounded.length - 1] += delta;

  return chunks.map((c, i) => ({
    ...c,
    daysWeight: weights[i],
    cents: rounded[i],
    amount: centsToAmount(rounded[i]),
  }));
}

/** ====== 打印表格辅助 ====== */
function printMonthlyRows(title, rows) {
  console.log(`\n=== ${title} ===`);
  console.table(
    rows.map((r) => ({
      month: r.month,
      account: r.account,
      nights: r.nights,
      daysWeight: r.daysWeight,
      amount: r.amount,
      amountCents: r.cents,
    }))
  );
  const sum = rows.reduce((s, r) => s + r.cents, 0);
  console.log(`合计（分）= ${sum} ；合计（金额）= ${(sum / 100).toFixed(2)}\n`);
}

/** ====== 示例：你可以在这里给一条或多条 Booking ====== */
const bookings = [
  {
    id: "B001",
    propertyTz: "America/Los_Angeles",
    // 注意：这里用 ISO 字符串（UTC）；实际你从 DB 读出来的 Date 也可以 toISOString()
    checkIn: "2025-06-10T07:00:00.000Z",  // 相当于 LA 当地 6/10 的某时间
    checkOut: "2025-08-03T07:00:00.000Z", // 退房日不计夜
    payout: 55.00, // 到手（Decimal，两位小数即可；内部会转分）
    // guestTotal: 可选，这里暂不使用；如果以后要分摊佣金也可以再加一次分配
  },
  // 你也可以再加一条跨两个月的：
  {
    id: "B002",
    propertyTz: "America/New_York",
    checkIn: "2025-09-28T04:00:00.000Z",
    checkOut: "2025-10-03T04:00:00.000Z",
    payout: 6,
  },
];

/** ====== 主流程：逐条 booking 计算并打印每月入账 ====== */
for (const b of bookings) {
  console.log(`\n>>> Booking ${b.id} | TZ=${b.propertyTz} | Payout=${b.payout.toFixed ? b.payout.toFixed(2) : b.payout}`);

  // 1) 切片（按物业时区）
  const chunks = splitNightsByMonthWithTZ(b.checkIn, b.checkOut, b.propertyTz);

  // 2) 分摊（按天，最后月 +1 天，差额入最后月）
  const alloc = allocateByDaysLastPlusOneDecimal(b.payout, chunks);

  // 3) 组装打印行
  const rows = alloc.map((c) => {
    const periodMonthUTC = toUTCMonthStart(c.periodMonthLocal);
    const y = periodMonthUTC.getUTCFullYear();
    const m = String(periodMonthUTC.getUTCMonth() + 1).padStart(2, "0");
    return {
      month: `${y}-${m}`,
      account: "RENT", // 这里先固定为 RENT；你也可以换成 ACCRUED_RENT_REVENUE 之类
      nights: c.nights,
      daysWeight: c.daysWeight,
      cents: c.cents,
      amount: c.amount,
    };
  });

  printMonthlyRows(`Booking ${b.id} 每月入账`, rows);

  //（可选）你还可以在这里把 rows 写入 CSV/打印更详细信息
}



/*export async function postBookingAccrualsmock(
  bookingId,
  deps = {
    prisma: realPrisma,
    splitNightsByMonth: realSplit,
    toUTCMonthStart: realToUTC,
    allocateByDays: realAlloc,
    defaultTz: DEFAULT_TIMEZONE
  }
) {
  const { prisma, splitNightsByMonth, toUTCMonthStart, allocateByDays, defaultTz } = deps;

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { room: { include: { property: true } }, lineItems: true }
  });
  if (!booking) throw new Error("Booking not found");

  const propertyTz = booking.tzSnapshot || booking.room.property.timezone || defaultTz;

  // 1) 用注入的切片函数
  const chunks = splitNightsByMonth(booking.checkIn, booking.checkOut, propertyTz);

  if (chunks.length === 0) return { posted: 0 };

  // 2) 金额
  const payout = booking.payout ?? 0;
  const guestTotal = booking.guestTotal ?? null;

  // 3) 分摊
  const rentAlloc = allocateByDays(payout, chunks);

  // 4) 事务 + upsert
  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < chunks.length; i++) {
      const periodMonthUTC = toUTCMonthStart(chunks[i].periodMonthLocal);

      const entry = await tx.journalEntry.upsert({
        where: { periodMonth: periodMonthUTC },
        create: {
          periodMonth: periodMonthUTC,
          memo: `Auto posting ${DateTime.fromJSDate(periodMonthUTC).toISODate()}`
        },
        update: {}
      });

      await tx.journalLine.upsert({
        where: {
          bookingId_lineItemId_account_periodMonth: {
            bookingId: booking.id,
            lineItemId: null,
            account: "RENT",  
            periodMonth: periodMonthUTC
          }
        },
        create: {
          journalId: entry.id,
          bookingId: booking.id,
          propertyId: booking.room?.propertyId,
          roomId: booking.roomId,
          account: "RENT",  
          amountCents: rentAlloc[i].cents,
          periodMonth: periodMonthUTC
        },
        update: { amountCents: rentAlloc[i].cents }
      });
    }

    if (!booking.tzSnapshot) {
      await tx.booking.update({ where: { id: booking.id }, data: { tzSnapshot: propertyTz } });
    }
  });

  return { posted: chunks.length };
}
*/