<script setup lang="ts">
import { ref, onMounted } from "vue";
import { api } from "../../api";
import RoomMap from "../Components/RoomMap.vue"; // 注意路径和大小写
import { DateTime } from "luxon";
import defaultColors from "../../config/colors.json"; // 直接导入 JSON

const data = ref<any[]>([]);
const loading = ref(false);
const colors = ref<{ [k: string]: string }>({});

async function load() {
  loading.value = true;
  try {
    const [res,roomColors] = await Promise.all([
    api.get("/propertieslist?includeRooms=true"),
    api.get("/settings/roomColors"),
  ]);
    data.value = res ?? [];
    colors.value = roomColors ?? {};
  } finally {
    loading.value = false;
  }
}

onMounted(load);

/** 根据 booking 状态给房间上色 */
function getRoomColor(room: any) {
  if (!room.bookings || room.bookings.length === 0) {
    return "lightgreen"; // 没有任何预订 → 绿色
  }

  const now = DateTime.now();
  const hasCurrent = room.bookings.some(
    (b: any) =>
      DateTime.fromISO(b.checkIn) <= now && DateTime.fromISO(b.checkOut) >= now
  );
  if (hasCurrent) return colors.value.current || defaultColors.current; // 当前有人入住 → 蓝色

  const hasFuture = room.bookings.some(
    (b: any) => DateTime.fromISO(b.checkIn) > now
  );
  if (hasFuture) return colors.value.future || defaultColors.future; // 将来有人入住 → 黄色

  return colors.value.empty || defaultColors.empty; // 其它情况 → 默认绿色
}
</script>

<template>
  <el-card shadow="never">
    <template #header>
      <div class="text-lg font-semibold">房态图 Demo</div>
    </template>

    <el-table v-loading="loading" :data="data" border style="width: 100%">
      <el-table-column prop="name" label="Property" width="200">
        <template #default="{ row }">
          <strong>{{ row.name }}</strong>
        </template>
      </el-table-column>

      <el-table-column label="Rooms">
        <template #default="{ row }">
          <!-- ✅ 把 getRoomColor 传进去 -->
          <RoomMap :property="row" :getRoomColor="getRoomColor" />
        </template>
      </el-table-column>
    </el-table>
  </el-card>
</template>
