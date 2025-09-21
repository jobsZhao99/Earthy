<script setup lang="ts">
import { ref, onMounted } from "vue";
import { api } from "../../api";
import RoomMap from "../Components/RoomMap.vue"; // 注意路径和大小写
import { DateTime } from "luxon";
import defaultColors from "../../config/colors.json"; // 直接导入 JSON

const data = ref<any[]>([]);
const loading = ref(false);
const colors = ref<{ [k: string]: string }>({});

// 弹窗状态
const dialogVisible = ref(false);
const form = ref({
  propertyId: "",
  label: "",
  nightlyRateCents: null as number | null,
  roomStatus: "CLEANED",
  tag: "",
});

const saving = ref(false);


async function load() {
  loading.value = true;
  try {
    const [res,roomColors] = await Promise.all([
    api.get("/property/list?includeRooms=true"),
    api.get("/settings/roomColors"),
  ]);
    data.value = res ?? [];
    colors.value = roomColors ?? {};
  } finally {
    loading.value = false;
  }
}


// 新建 room
async function saveRoom() {
  if (!form.value.propertyId || !form.value.label) {
    return alert("请选择物业并填写房间号");
  }
  saving.value = true;
  try {
    await api.post("/room", form.value);
    dialogVisible.value = false;
    await load();
    // 重置表单
    form.value = {
      propertyId: "",
      label: "",
      nightlyRateCents: null,
      roomStatus: "CLEANED",
      tag: "",
    };
  } finally {
    saving.value = false;
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
      <div class="flex justify-between items-center">
        <div class="text-lg font-semibold">Room Map</div>
        <el-button type="primary" size="small" @click="dialogVisible = true">
          Create Room
        </el-button>
      </div>
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

  <!-- ✅ 新建房间弹窗 -->
  <el-dialog v-model="dialogVisible" title="Create Room" width="500px">
    <el-form label-width="100px">
      <el-form-item label="Property">
        <el-select v-model="form.propertyId" placeholder="Please select property" style="width: 100%" filterable>
          <el-option
            v-for="p in data"
            :key="p.id"
            :label="p.name"
            :value="p.id"
          />
        </el-select>
      </el-form-item>

      <el-form-item label="Room Label">
        <el-input v-model="form.label" placeholder="Ex: 101" />
      </el-form-item>

      <el-form-item label="Default Nightly Rate">
        <el-input-number
          v-model="form.nightlyRateCents"
          :min="0"
          placeholder="unit: cent"
          style="width: 100%"
        />
      </el-form-item>

      <el-form-item label="Status">
        <el-select v-model="form.roomStatus" style="width: 100%">
          <el-option label="CLEANED" value="CLEANED" />
          <el-option label="OCCUPIED" value="OCCUPIED" />
          <el-option label="MAINTENANCE" value="MAINTENANCE" />
          <el-option label="LONG_TERM" value="LONG_TERM" />
        </el-select>
      </el-form-item>

      <el-form-item label="tag">
        <el-input v-model="form.tag" placeholder="option" />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="dialogVisible = false">Cancel</el-button>
      <el-button type="primary" :loading="saving" @click="saveRoom">Save</el-button>
    </template>
  </el-dialog>
</template>
