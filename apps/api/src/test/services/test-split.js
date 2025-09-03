import { DateTime } from "luxon";
import { splitNightsByMonth, toUTCMonthStart } from "../../utils/timezone.js";
// ↑ 注意改成你项目里 splitNightsByMonth 的真实路径

const checkIn = new Date("2025-06-10T15:00:00");   // 6月10日入住
const checkOut = new Date("2025-08-03T11:00:00");  // 8月3日退房
const propertyTz = "America/Los_Angeles";          // 用物业所在时区切分

const chunks = splitNightsByMonth(checkIn, checkOut,propertyTz);

// 打印原始对象
console.log("原始 chunks:", chunks);

// 美化打印：只关心月份+晚数
console.table(
  chunks.map(c => ({
    month: c.periodMonthLocal instanceof Date 
      ? DateTime.fromJSDate(c.periodMonthLocal).toFormat("yyyy-MM")
      : String(c.periodMonthLocal),
    nights: c.nights
  }))
);
