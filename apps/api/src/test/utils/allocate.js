import { allocateByDays } from "../../utils/allocate.js"; // 假设函数存在 allocate.js

// 模拟一个 booking 跨 3 个月，night 分别 10, 15, 5
const chunks = [
  { periodMonthLocal: "2025-06-01", nights: 10 },
  { periodMonthLocal: "2025-07-01", nights: 15 },
  { periodMonthLocal: "2025-08-01", nights: 5 },
];

const totalCents = 10000; // $100.00

const result = allocateByDays(totalCents, chunks);
console.log("分摊结果：", result);
console.log(
  "合计 =",
  result.reduce((s, c) => s + c.cents, 0),
  "（应该等于", totalCents, "）"
);

