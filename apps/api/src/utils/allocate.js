/**
 * 按“天”分摊（最后一个月 +1 天权重），两位小数，差额入最后一月
 * - total 可为 number / string / Prisma Decimal
 * - chunks: [{ periodMonthLocal, nights, ... }]
 * 返回: 与 chunks 对应的数组，附加 { cents, amount, daysWeight }
 */
export function allocateByDays(total, chunks) {
  const toCents = (v) => {
    if (v == null || v === '') return 0;
    // 兼容 Prisma Decimal / Big.js：转字符串再处理
    const n = typeof v === 'object' ? Number(v.toString()) : Number(v);
    if (!Number.isFinite(n)) throw new Error('total 不是合法数字');
    // 按财务口径四舍五入到分
    return Math.round(n * 100);
  };
  const centsToAmount = (c) => ((c / 100).toFixed(2)); // 字符串，保留两位

  // 边界：空或无金额
  if (!Array.isArray(chunks) || chunks.length === 0) return [];
  const totalCents = toCents(total);
  if (totalCents === 0) {
    return chunks.map(c => ({ ...c, cents: 0, amount: '0.00', daysWeight: 0 }));
  }

  // 天数权重：用 nights；最后一个月 +1 天
  const weights = chunks.map(c => Math.max(0, Number(c.nights) || 0));
  weights[weights.length - 1] += 1;

  const totalDays = weights.reduce((s, d) => s + d, 0);
  if (totalDays <= 0) {
    // 无权重：全部金额放到最后一月
    return chunks.map((c, i, arr) => {
      const cents = (i === arr.length - 1) ? totalCents : 0;
      return { ...c, cents, amount: centsToAmount(cents), daysWeight: 0 };
    });
  }

  // 先按比例算“精确分”（可能有小数分），再四舍五入到分
  const exactCents = weights.map(w => (totalCents * w) / totalDays);
  const rounded = exactCents.map(x => Math.round(x)); // 到“分”的四舍五入

  // 处理四舍五入误差：把差额（正/负）全部入最后一月
  const assigned = rounded.reduce((s, v) => s + v, 0);
  const delta = totalCents - assigned;
  rounded[rounded.length - 1] += delta;

  // 产出
  return chunks.map((c, i) => ({
    ...c,
    daysWeight: weights[i],
    cents: rounded[i],
    amount: centsToAmount(rounded[i]), // 两位小数的字符串
  }));
}
