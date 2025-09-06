<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { api } from '../../api';
import type { Paged, BookingRecord, Property } from '../../types';
import { DateTime } from 'luxon';
import { useRouter } from 'vue-router';

const router = useRouter();
const loading = ref(false);

const q = ref({
  propertyId: '',
  from: '',
  to: '',
  page: 1,
  pageSize: 20,
});

const properties = ref<Property[]>([]);
const data = ref<Paged<BookingRecord>>({ page:1, pageSize:20, total:0, rows:[] });

async function loadProperties() {
  const res = await api.get('/properties');
  // console.log(res);
  properties.value = res.rows ?? res ?? [];
}

async function load() {
  loading.value = true;
  try {
    const params: any = { page: q.value.page, pageSize: q.value.pageSize };
    if (q.value.propertyId) params.propertyId = q.value.propertyId;
    if (q.value.from) params.from = q.value.from;
    if (q.value.to) params.to = q.value.to;

    const res = await api.get('/bookings?' + new URLSearchParams(params).toString());
    data.value = res;
  } finally {
    loading.value = false;
  }
}

function fmt(dt: string) {
  return DateTime.fromISO(dt).toFormat('yyyy-LL-dd HH:mm');
}

onMounted(async () => {
  await loadProperties();
  await load();
});

watch(q, () => load(), { deep: true });
</script>

<template>
  <div class="flex items-center gap-3 mb-3">
    <el-select v-model="q.propertyId" placeholder="Property" clearable filterable style="width:280px">
      <el-option v-for="p in properties" :key="p.id" :label="p.name" :value="p.id" />
    </el-select>

    <el-date-picker v-model="q.from" type="date" placeholder="From" value-format="YYYY-MM-DD" />
    <el-date-picker v-model="q.to" type="date" placeholder="To" value-format="YYYY-MM-DD" />

    <el-button type="primary" @click="router.push('/bookings/new')">New Booking</el-button>
  </div>

  <el-table :data="data.rows" v-loading="loading" border>
    <el-table-column label="Property" width="240" :formatter="(_, __, row) => row?.room?.property?.name || ''" />
    <el-table-column label="Room" prop="room.label" width="120" />
    <el-table-column label="Guest" :formatter="(_, __, row) => row?.guest?.name || ''" width="160" />
    <el-table-column label="Check In" :formatter="(_, __, row) => fmt(row?.checkIn)" width="180" />
    <el-table-column label="Check Out" :formatter="(_, __, row) => fmt(row?.checkOut)" width="180" />
    <el-table-column label="Channel" prop="channel" width="130" />
    <el-table-column label="Payout" :formatter="(_, __, row) => (row?.payoutCents ?? 0) / 100" width="110" />
  </el-table>

  <div class="mt-3 flex justify-end">
    <el-pagination
      layout="prev, pager, next, sizes, total"
      :page-sizes="[10,20,50,100]"
      v-model:current-page="q.page"
      v-model:page-size="q.pageSize"
      :total="data.total"
    />
  </div>
</template>

<style scoped>
.flex { display:flex }
.items-center { align-items:center }
.gap-3 { gap:12px }
.mb-3 { margin-bottom:12px }
.mt-3 { margin-top:12px }
.justify-end { justify-content: flex-end }
</style>
