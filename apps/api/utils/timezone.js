// utils/timezone.js
import { DateTime } from "luxon";
export const DEFAULT_TIMEZONE = process.env.DEFAULT_TIMEZONE || "America/Los_Angeles";

/** 以 propertyTz（IANA）把 UTC 的入住/退房按“当地日历”切片到各月份 */
export function splitNightsByMonth(checkInUTC, checkOutUTC, propertyTz = DEFAULT_TIMEZONE) {
  const ciLocal = DateTime.fromJSDate(checkInUTC, { zone: "utc" }).setZone(propertyTz).startOf("day");
  const coLocal = DateTime.fromJSDate(checkOutUTC, { zone: "utc" }).setZone(propertyTz).startOf("day");
  if (coLocal <= ciLocal) return [];

  const chunks = [];
  let cur = ciLocal;
  while (cur < coLocal) {
    const monthEndNext = cur.endOf("month").plus({ day: 1 }).startOf("day"); // 下月1号
    const next = monthEndNext < coLocal ? monthEndNext : coLocal;
    const nights = Math.floor(next.diff(cur, "days").days);
    const periodMonthLocal = cur.startOf("month");
    chunks.push({
      periodMonthLocal, // 当地月初
      nights
    });
    cur = next;
  }
  return chunks;
}

/** 把“当地月初”转成 UTC 存库（periodMonth 统一为当月 UTC 月初） */
export function toUTCMonthStart(dateTimeLocal /* DateTime */, propertyTz = DEFAULT_TIMEZONE) {
  // 传入是当地月初的 DateTime，这里转成 UTC 的 JS Date
  return dateTimeLocal.setZone(propertyTz).startOf("month").toUTC().toJSDate();
}

/** 工具：把 Date|ISO 转换为“当地 00:00”的 DateTime */
function toLocalDayStart(value, tz) {
  const dt = value instanceof Date
    ? DateTime.fromJSDate(value, { zone: "utc" })
    : DateTime.fromISO(String(value), { zone: "utc" });
  return dt.setZone(tz).startOf("day");
}
