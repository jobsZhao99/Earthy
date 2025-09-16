<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from '../../../api';
import type { BookingRecord, Property } from '../../../types';
import { DateTime } from 'luxon';

const today = DateTime.now().toFormat('yyyy-LL-dd');
const properties = ref<Property[]>([]);
const checkInRows = ref<BookingRecord[]>([]);
const checkOutRows = ref<BookingRecord[]>([]);
const loading = ref(false);
const selectedProperty = ref('');

async function loadProperties() {
  const res = await api.get('/properties');
  properties.value = res.rows ?? res ?? [];
}

async function loadData() {
  loading.value = true;
  try {
    const params: any = {};
    if (selectedProperty.value) params.propertyId = selectedProperty.value;

    const res = await api.get('/today-bookings?' + new URLSearchParams(params));
    const rows: BookingRecord[] = res.rows ?? res;

    checkInRows.value = rows.filter(r => r.checkIn?.startsWith(today));
    checkOutRows.value = rows.filter(r => r.checkOut?.startsWith(today));
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  await loadProperties();
  await loadData();
});
</script>

<template>
  <div class="flex items-center gap-3 mb-4">
    <el-select v-model="selectedProperty" placeholder="Property" clearable filterable style="width:300px" @change="loadData">
      <el-option v-for="p in properties" :key="p.id" :label="p.name" :value="p.id" />
    </el-select>
    <el-button @click="loadData" :loading="loading">Refresh</el-button>
    <span class="ml-auto text-gray-500">Today: {{ today }}</span>
  </div>

  <h2 class="text-lg font-bold mb-2">🏡 Today Check-in</h2>
  <el-table :data="checkInRows" v-loading="loading" border>
    <el-table-column label="Property" prop="room.property.name" />

    <el-table-column label="Room" prop="room.label" />
    <el-table-column label="Guest" prop="guest.name" />
    <el-table-column label="Check In" prop="checkIn" />
    <el-table-column label="Check Out" prop="checkOut" />
    <el-table-column label="Channel" prop="channel" />
  </el-table>

  <h2 class="text-lg font-bold mt-6 mb-2">🚪 Today Check-out</h2>
  <el-table :data="checkOutRows" v-loading="loading" border>
    <el-table-column label="Property" prop="room.property.name" />

    <el-table-column label="Room" prop="room.label" />
    <el-table-column label="Guest" prop="guest.name" />
    <el-table-column label="Check In" prop="checkIn" />
    <el-table-column label="Check Out" prop="checkOut" />
    <el-table-column label="Channel" prop="channel" />
  </el-table>
</template>

<style scoped>
.text-lg { font-size: 1.125rem }
.font-bold { font-weight: bold }
.mb-2 { margin-bottom: 0.5rem }
.mt-6 { margin-top: 1.5rem }
</style>
