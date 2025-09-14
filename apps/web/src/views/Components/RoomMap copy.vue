<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  property: {
    id: string;
    name: string;
    rooms: { id: string; label: string }[];
  };
}>();

function cmpRoom(a: any, b: any) {
  const na = parseInt(String(a.label), 10);
  const nb = parseInt(String(b.label), 10);
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
  return String(a.label).localeCompare(String(b.label));
}

const processed = computed(() => {
  const floorsMap: Record<string, any[]> = {};
  const looseRooms: any[] = [];

  (props.property.rooms || []).forEach((r) => {
    const label = String(r.label).trim();
    const m = label.match(/^(\d)\d{2}$/); // 三位纯数字
    if (m) {
      const floor = m[1];
      (floorsMap[floor] ||= []).push(r);
    } else {
      looseRooms.push(r);
    }
  });

  const floors = Object.entries(floorsMap)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([floor, rooms]) => ({
      floor,
      rooms: (rooms as any[]).sort(cmpRoom),
    }));

  looseRooms.sort(cmpRoom);

  return { floors, looseRooms };
});
</script>

<template>
  <div>
    <div v-if="processed.looseRooms.length" style="margin-bottom:8px">
      <div><b></b></div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-left:16px">
        <el-tag v-for="r in processed.looseRooms" :key="r.id" type="success" effect="plain">
          {{ r.label }}
        </el-tag>
      </div>
    </div>

    <div v-for="f in processed.floors" :key="f.floor" style="margin-bottom:8px">
      <!-- <div><b>Floor {{ f.floor }}</b></div> -->
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-left:16px">
        <el-tag v-for="r in f.rooms" :key="r.id" type="success" effect="plain">
          {{ r.label }}
        </el-tag>
      </div>
    </div>

    <div v-if="!processed.looseRooms.length && !processed.floors.length" style="color:#999">
      No rooms
    </div>
  </div>
</template>
