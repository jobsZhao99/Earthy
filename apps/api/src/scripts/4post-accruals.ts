import 'dotenv/config';
import { PrismaClient, AccountCode } from '@prisma/client';
import { DateTime } from 'luxon';
import cliProgress from 'cli-progress';

const prisma = new PrismaClient();

/** 把 [start, end) 区间按天数聚合到各自然月。
 *  - start/end 都按本地日界限取 00:00；我们用“入住晚数”的语义：end 为“退房日当天不算晚”。
 *  - 若 end <= start，但金额非 0，则将整笔入账到 start 所在月（做 1 天处理）。
 */
function daysPerMonth(startJS: Date, endJS?: Date) {
  // console.log('Calculating days per month for', startJS, 'to', endJS ?? '(1 day)');
  // let start = DateTime.fromJSDate(startJS).startOf('day');
  // let end = endJS 
  // ? DateTime.fromJSDate(endJS).plus({ days: 1 }).startOf('day') 
  // : start.plus({ days: 1 });

  let start = DateTime.fromJSDate(startJS).toUTC().startOf("day");
  let end = endJS
    ? DateTime.fromJSDate(endJS).plus({ days: 1 }).toUTC().startOf("day") // 退房日不算
    : start.plus({ days: 1 });
  // console.log('Calculating days per month for', start, 'to', end ?? '(1 day)');

  // 防御：确保至少 1 天（适配没有 rangeEnd 的记录）
  if (end <= start) end = start.plus({ days: 1 });

  const map = new Map<string, number>(); // key: 'YYYY-MM-01', value: 天数
  let cursor = start;
  while (cursor < end) {
    const key = cursor.startOf('month').toISODate(); // YYYY-MM-01
    map.set(key, (map.get(key) ?? 0) + 1);
    cursor = cursor.plus({ days: 1 });
  }
  // console.log(Object.fromEntries(map));

  return map;
}

/** 金额按各月天数比例分摊，返回每月整数金额（单位：分）
 *  - 使用“最大余数法”保证分摊后各月之和 == total
 *  - total 可以为负数（取消时）
 */
function allocateByDays(total: number, monthDays: Array<{ key: string; days: number }>) {
  if (!Number.isFinite(total) || total === 0 || monthDays.length === 0) {
    return new Map<string, number>();
  }

  const totalDays = monthDays.reduce((s, d) => s + d.days, 0);
  if (totalDays <= 0) {
    const m = new Map<string, number>();
    m.set(monthDays[0].key, total);
    return m;
  }

  const alloc = new Map<string, number>();

  let allocated = 0;
  for (let i = 0; i < monthDays.length; i++) {
    const { key, days } = monthDays[i];

    if (i < monthDays.length - 1) {
      // 除了最后一个月，用四舍五入 / floor 分配
      const share = Math.round((total * days) / totalDays);
      alloc.set(key, share);
      allocated += share;
    } else {
      // 最后一个月直接吞掉 remainder，保证总和 == total
      const remainder = total - allocated;
      alloc.set(key, remainder);
    }
  }

  return alloc;
}

// function allocateByDays(total: number, monthDays: Array<{ key: string; days: number }>) {
//   if (!Number.isFinite(total) || total === 0 || monthDays.length === 0) {
//     return new Map<string, number>();
//   }
//   const totalDays = monthDays.reduce((s, d) => s + d.days, 0);
//   if (totalDays <= 0) {
//     // 保险：全部给第一个月
//     const m = new Map<string, number>();
//     m.set(monthDays[0].key, total);
//     return m;
//   }

//   type Row = { key: string; days: number; exact: number; base: number; diff: number };
//   const rows: Row[] = monthDays.map(({ key, days }) => {
//     const exact = (total * days) / totalDays; // 可能是小数/负数
//     let base: number;
//     let diff: number;
//     if (total >= 0) {
//       base = Math.floor(exact);
//       diff = exact - base; // [0,1)
//     } else {
//       base = Math.ceil(exact);
//       diff = base - exact; // [0,1)：离下一个更负整数的距离
//     }
//     return { key, days, exact, base, diff };
//   });

//   const sumBase = rows.reduce((s, r) => s + r.base, 0);
//   let remainder = total - sumBase; // 对于正数 >=0；负数 <=0

//   // 排序规则：
//   //  - total >= 0：diff 大的优先加 1
//   //  - total < 0：diff 大的优先减 1（因为我们先用了 ceil，基数之和会偏大）
//   rows.sort((a, b) => b.diff - a.diff);

//   const alloc = new Map<string, number>();
//   for (const r of rows) alloc.set(r.key, r.base);

//   if (remainder > 0) {
//     for (let i = 0; i < remainder; i++) {
//       const k = rows[i % rows.length].key;
//       alloc.set(k, (alloc.get(k) ?? 0) + 1);
//     }
//   } else if (remainder < 0) {
//     const need = -remainder;
//     for (let i = 0; i < need; i++) {
//       const k = rows[i % rows.length].key;
//       alloc.set(k, (alloc.get(k) ?? 0) - 1);
//     }
//   }

//   return alloc;
// }

async function main() {
  console.log('▶ Start generating JournalLines (monthly split)…');

  // 预加载所有 BookingRecord（含链路取到 ledger），并带上已存在的 journalLines
  const records = await prisma.bookingRecord.findMany({
    include: {
      booking: {
        include: {
          room: { include: { property: { include: { ledger: true } } } },
        },
      },
      journalLines: true,
    },
  });
  console.log(`Found ${records.length} bookingRecords`);

  // 进度条
  const bar = new cliProgress.SingleBar(
    { format: 'Posting |{bar}| {percentage}% | {value}/{total} rec | OK:{ok} FAIL:{fail}' },
    cliProgress.Presets.shades_classic
  );
  let ok = 0;
  let fail = 0;
  bar.start(records.length, 0, { ok, fail });

  // 缓存：同一账簿、同一月份的 JournalEntry 只创建/查询一次
  const journalCache = new Map<string, { id: string }>(); // key: `${ledgerId}|${YYYY-MM-01}`

  for (const r of records) {
    try {
      const ledger = r.booking?.room?.property?.ledger;
      if (!ledger) {
        console.warn(`⚠️ record ${r.id} has no ledger. skip`);
        fail++;
        bar.increment({ ok, fail });
        continue;
      }

      // 计算各月天数
      const baseStart = r.rangeStart ; // 不允许 null
      const baseEnd = r.rangeEnd; // 允许 undefined（将作为 1 天）
      const monthDaysMap = daysPerMonth(baseStart, baseEnd);
      const monthDays = [...monthDaysMap.entries()].map(([key, days]) => ({ key, days }));

      // 分摊金额（示例：只处理客款收入 → RENT）
      const allocGuest = allocateByDays(r.payoutDeltaCents ?? 0, monthDays);

      // 如需分摊 payoutDeltaCents，可打开这行并设置科目（例：OTHERS）
      // const allocPayout = allocateByDays(r.payoutDeltaCents ?? 0, monthDays);

      // 为每个月生成/更新 JournalLine
      for (const { key: monthKey } of monthDays) {
        // 1) 找/建 JournalEntry(periodMonth = 该月1号UTC)
        const periodMonth = DateTime.fromISO(monthKey).startOf('month').toJSDate();
        const jKey = `${ledger.id}|${monthKey}`;
        let journal = journalCache.get(jKey);

        if (!journal) {
          // 先尝试找
          const found = await prisma.journalEntry.findUnique({
            where: { periodMonth_ledgerId: { periodMonth, ledgerId: ledger.id } },
            select: { id: true },
          });
          if (found) {
            journal = found;
          } else {
            // 没有则创建
            journal = await prisma.journalEntry.create({
              data: {
                periodMonth,
                ledgerId: ledger.id,
                memo: `Auto for ${monthKey}`,
              },
              select: { id: true },
            });
          }
          journalCache.set(jKey, journal);
        }

        // 2) 生成该月的 JournalLine（RENT）
        const rentCents = allocGuest.get(monthKey) ?? 0;
        if (rentCents !== 0) {
          await prisma.journalLine.upsert({
            where: {
              bookingRecordId_account_journalId: {
                bookingRecordId: r.id,
                account: AccountCode.RENT,
                journalId: journal.id,
              },
            },
            update: { amountCents: rentCents },
            create: {
              journalId: journal.id,
              bookingRecordId: r.id,
              account: AccountCode.RENT,
              amountCents: rentCents,
            },
          });
        }

        // 3) 若需要，也可为 payout 分摊生成另一条科目：
        // const payoutCents = allocPayout.get(monthKey) ?? 0;
        // if (payoutCents !== 0) {
        //   await prisma.journalLine.upsert({
        //     where: {
        //       bookingRecordId_account_journalId: {
        //         bookingRecordId: r.id,
        //         account: AccountCode.OTHERS,
        //         journalId: journal.id,
        //       },
        //     },
        //     update: { amountCents: payoutCents },
        //     create: {
        //       journalId: journal.id,
        //       bookingRecordId: r.id,
        //       account: AccountCode.OTHERS,
        //       amountCents: payoutCents,
        //     },
        //   });
        // }
      }

      ok++;
    } catch (err: any) {
      fail++;
      console.error(`❌ record ${r.id} failed:`, err?.message ?? err);
    } finally {
      bar.increment({ ok, fail });
    }
  }

  bar.stop();
  console.log(`🎉 Done. OK=${ok}, FAIL=${fail}`);
}

main()
  .catch((e) => {
    console.error('❌ Script crashed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
