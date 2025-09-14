<script setup lang="ts">
import { defineProps, computed } from "vue";

interface Room {
  id: string;
  label: string;
  bookings?: {
    id: string;
    checkIn: string;
    checkOut: string;
    status: string;
  }[];
}

interface Property {
  id: string;
  name: string;
  rooms: Room[];
}

const props = defineProps<{
  property: Property;
  /** 外部决定颜色：return '#RRGGBB' */
  getRoomColor?: (room: Room) => string;
}>();

/** 列头：1~9 + 0(第10列) */
const COLS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

/** 是否纯数字 */
const isDigits = (s: string) => /^\d+$/.test(s);

/** 取列键：末位数字；非数字或 Whole Unit → '1' 列 */
function colKey(label: string): string {
  if (/^whole\s*unit$/i.test(label)) return "1";
  if (isDigits(label)) {
    return label.slice(-1); // 末位
  }
  return "1";
}

/** 取楼层：仅当是 >=3 位数字时，首位做楼层；否则返回 null */
function floorOf(label: string): number | null {
  if (isDigits(label) && label.length >= 3) {
    return Number(label[0]); // 101 → 1层
  }
  return null;
}

/** 预处理：分楼层矩阵 + whole unit 行 + 其他行 */
const processed = computed(() => {
  const byFloor: Record<number, Record<string, Room[]>> = {};
  const otherRow: Record<string, Room[]> = {};
  const wholeRow: Record<string, Room[]> = {};

  for (const r of (props.property.rooms || []).slice().sort((a, b) => a.label.localeCompare(b.label))) {
    if (/^whole\s*unit$/i.test(r.label)) {
      const col = colKey(r.label);
      wholeRow[col] ||= [];
      wholeRow[col].push(r);
      continue;
    }

    const floor = floorOf(r.label);
    const col = colKey(r.label);

    if (floor != null) {
      byFloor[floor] ||= {};
      byFloor[floor][col] ||= [];
      byFloor[floor][col].push(r);
    } else {
      otherRow[col] ||= [];
      otherRow[col].push(r);
    }
  }

  const floors = Object.keys(byFloor)
    .map((n) => Number(n))
    .sort((a, b) => a - b)
    .map((f) => ({ floor: f, cols: byFloor[f] }));

  return { floors, otherRow, wholeRow };
});
</script>

<template>
  <div>
    <table
      border="1"
      cellspacing="0"
      cellpadding="0"
      style="border-collapse: collapse; width: 100%; table-layout: fixed;"
    >
      <tbody>
        <!-- Whole Unit 独立一行 -->
        <tr v-if="Object.keys(processed.wholeRow).length">
          <!-- <td style="width: 100px;"><strong>Whole Unit</strong></td> -->
          <td
            v-for="c in COLS"
            :key="'whole-'+c"
            style="text-align:center; height:40px; padding:0;"
          >
            <template v-if="processed.wholeRow[c]?.length">
              <div
                v-for="r in processed.wholeRow[c]"
                :key="r.id"
                :style="{
                  backgroundColor: props.getRoomColor ? props.getRoomColor(r) : '#22C55E',
                  width: '100%',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontWeight: 'bold',
                }"
              >
                {{ r.label }}
              </div>
            </template>
            <template v-else>–</template>
          </td>
        </tr>

        <!-- 每层一行 -->
        <tr v-for="f in processed.floors" :key="f.floor">
          <!-- <td style="width: 100px;"><strong>{{ f.floor }}</strong></td> -->
          <td
            v-for="c in COLS"
            :key="c"
            style="text-align:center; height:40px; padding:0;"
          >
            <template v-if="f.cols[c]?.length">
              <div
                v-for="r in f.cols[c]"
                :key="r.id"
                :style="{
                  backgroundColor: props.getRoomColor ? props.getRoomColor(r) : '#22C55E',
                  width: '100%',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontWeight: 'bold',
                }"
              >
                {{ r.label }}
              </div>
            </template>
            <template v-else>–</template>
          </td>
        </tr>

        <!-- 其他行 -->
        <tr v-if="Object.keys(processed.otherRow).length">
          <!-- <td style="width: 100px;"><strong>Other</strong></td> -->
          <td
            v-for="c in COLS"
            :key="'other-'+c"
            style="text-align:center; height:40px; padding:0;"
          >
            <template v-if="processed.otherRow[c]?.length">
              <div
                v-for="r in processed.otherRow[c]"
                :key="r.id"
                :style="{
                  backgroundColor: props.getRoomColor ? props.getRoomColor(r) : '#22C55E',
                  width: '100%',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontWeight: 'bold',
                }"
              >
                {{ r.label }}
              </div>
            </template>
            <template v-else>–</template>
          </td>
        </tr>

        <!-- 没有房 -->
        <tr
          v-if="!processed.floors.length && !Object.keys(processed.otherRow).length && !Object.keys(processed.wholeRow).length"
        >
          <td colspan="11" style="color:#999; text-align:center;">No rooms</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>


