<!-- pages/Search.vue -->
<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '../../api';

const route = useRoute();
const guests = ref<any[]>([]);
const properties = ref<any[]>([]);
const bookings = ref<any[]>([]);
const loading = ref(false);

onMounted(async () => {
  const q = route.query.q as string;
  if (!q) return;

  loading.value = true;

  const [bookingsRes, propertiesRes, guestsRes] = await Promise.all([
    api.get(`/bookings?search=${q}`),
    api.get(`/properties?search=${q}`),
    api.get(`/guests?search=${q}`),
  ]);

  bookings.value = bookingsRes.rows.map(b => ({ ...b, type: 'Booking' }));
  properties.value = propertiesRes.rows.map(p => ({ ...p, type: 'Property' }));
  guests.value = guestsRes.rows.map(g => ({ ...g, type: 'Guest' }));

  loading.value = false;
});

</script>

<template>
    <div>
      <h2>Search Results</h2>
      <el-skeleton v-if="loading" :rows="6" animated />
  
      <template v-else>
        <div v-if="guests.length">
          <h3>Guests</h3>
          <el-table :data="guests">
            <el-table-column prop="name" label="Name" />
            <el-table-column prop="email" label="Email" />
            <el-table-column label="Actions">
              <template #default="{ row }">
                <el-button size="small" @click="$router.push(`/guests/${row.id}`)">View</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
  
        <div v-if="properties.length" class="mt-4">
          <h3>Properties</h3>
          <el-table :data="properties">
            <el-table-column prop="name" label="Name" />
            <el-table-column prop="address" label="Address" />
            <el-table-column label="Actions">
              <template #default="{ row }">
                <el-button size="small" @click="$router.push(`/properties/${row.id}`)">View</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
  
        <div v-if="bookings.length" class="mt-4">
          <h3>Bookings</h3>
          <el-table :data="bookings">
            <el-table-column prop="id" label="ID" />
            <el-table-column prop="checkIn" label="Check-in" />
            <el-table-column prop="checkOut" label="Check-out" />
            <el-table-column label="Actions">
              <template #default="{ row }">
                <el-button size="small" @click="$router.push(`/bookings/detail/${row.id}`)">View</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </template>
    </div>
  </template>
  