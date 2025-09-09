<!-- PropertyDetail.vue -->
<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '../../api';
import type { Property, BookingRecord } from '../../types';
import { DateTime } from 'luxon';

const route = useRoute();
const propertyId = route.params.id as string;

const property = ref<Property | null>(null);
const bookings = ref<BookingRecord[]>([]);
const loading = ref(true);

async function loadDetail() {
  loading.value = true;
  try {
    const propRes = await api.get(`/properties/${propertyId}`);
    property.value = propRes;

    const bookingsRes = await api.get('/bookings?' + new URLSearchParams({
      propertyId,
      pageSize: '1000'
    }).toString());

    bookings.value = bookingsRes.rows ?? [];
  } finally {
    loading.value = false;
  }
}

function fmtDate(dt: string) {
  return DateTime.fromISO(dt).toFormat('yyyy-LL-dd');
}

onMounted(loadDetail);
</script>

<template>
  <div v-if="loading" class="text-gray-500">Loading...</div>

  <div v-else>
    <h1 class="text-2xl font-bold mb-4">Property: {{ property?.name }}</h1>
    <p><strong>Address:</strong> {{ property?.address }}</p>
    <p><strong>Timezone:</strong> {{ property?.timezone }}</p>

    <h2 class="text-xl font-bold mt-6 mb-2">Bookings</h2>
    <el-table :data="bookings" border>
      <el-table-column label="Room" prop="room.label" width="120" />
      <el-table-column label="Guest" prop="guest.name" width="160" />
      <el-table-column label="Check In" prop="checkIn" :formatter="row => fmtDate(row.checkIn)" width="180" />
      <el-table-column label="Check Out" prop="checkOut" :formatter="row => fmtDate(row.checkOut)" width="180" />
      <el-table-column label="Channel" prop="channel" width="130" />
      <el-table-column
        label="Guest Total"
        :formatter="(row) => row?.guestTotalCents != null ? '$' + (row.guestTotalCents / 100).toFixed(2) : ''"
        width="120"
      />
    </el-table>
  </div>
</template>

<style scoped>
.text-xl { font-size: 1.25rem }
.text-2xl { font-size: 1.5rem }
.font-bold { font-weight: bold }
.mt-6 { margin-top: 1.5rem }
.mb-4 { margin-bottom: 1rem }
.mb-2 { margin-bottom: 0.5rem }
</style>
