<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '../../api';
import type { Guest, BookingRecord } from '../../types';
import { DateTime } from 'luxon';

const route = useRoute();
const guestId = route.params.id as string;

const guest = ref<Guest | null>(null);
const bookings = ref<BookingRecord[]>([]);
const loading = ref(false);

function fmt(dt: string) {
  return DateTime.fromISO(dt).toFormat('yyyy-LL-dd');
}

async function load() {
  loading.value = true;
  const g = await api.get(`/guests/${guestId}`);
  const b = await api.get(`/guests/${guestId}/bookings`);
  guest.value = g;
  bookings.value = b.rows ?? b ?? [];
  loading.value = false;
}

onMounted(() => {
  load();
});
</script>


<template>
    <div v-if="guest">
      <h2 class="text-xl font-bold mb-2">Guest: {{ guest.name }}</h2>
      <p>Email: {{ guest.email }}</p>
      <p>Phone: {{ guest.phone }}</p>
      <p>Created at: {{ fmt(guest.createdAt) }}</p>
  
      <el-divider>Bookings</el-divider>
  
      <el-table :data="bookings" v-loading="loading" border>
        <el-table-column label="Property" prop="room.property.name" width="220" />
        <el-table-column label="Room" prop="room.label" width="100" />
        <el-table-column label="Check In" :formatter="row => fmt(row.checkIn)" width="140" />
        <el-table-column label="Check Out" :formatter="row => fmt(row.checkOut)" width="140" />
        <el-table-column label="Channel" prop="channel" width="100" />
        <el-table-column label="Status" prop="status" width="100" />
      </el-table>
    </div>
  </template>
  