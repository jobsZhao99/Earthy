<script setup lang="ts">
import { ref, onMounted } from "vue";
import { api } from "../../api";
import RoomMap from "../Components/RoomMap.vue";
import { DateTime } from "luxon";

const data = ref<any[]>([]);
const loading = ref(false);

async function load() {
  loading.value = true;
  try {
    const res = await api.get("/propertieslist?includeRooms=true");
    data.value = res ?? [];
  } finally {
    loading.value = false;
  }
}

onMounted(load);

// === 颜色逻辑 ===
function getRoomColor(room: any) {
  const now = DateTime.now();

  if (
    room.bookings?.some(b => {
      const checkIn = DateTime.fromISO(b.checkIn);
      const checkOut = DateTime.fromISO(b.checkOut);
      return checkIn <= now && checkOut >= now; // 当前入住
    })
  ) {
    return "dodgerblue";
  }

  if (
    room.bookings?.some(b => {
      const checkIn = DateTime.fromISO(b.checkIn);
      return checkIn > now; // 未来预订
    })
  ) {
    return "gold";
  }

  return "lightgreen"; // 没有预订
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
          <RoomMap :property="row" :getRoomColor="getRoomColor" />
        </template>
      </el-table-column>
    </el-table>
  </el-card>
</template>
