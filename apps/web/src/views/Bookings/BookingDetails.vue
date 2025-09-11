<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../../api';
import type { BookingRecord } from '../../types';
import dayjs from 'dayjs';

const route = useRoute();
const router = useRouter();
interface BookingDetail {
  id: string;
  checkIn: string;
  checkOut: string;
  channel?: string;
  confirmationCode?: string;
  contractUrl?: string;
  payoutCents?: number;
  guestTotalCents?: number;
  tzSnapshot?: string;
  memo?: string;

  guest: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
  };

  room: {
    id: string;
    label: string;
    property: {
      id: string;
      name: string;
      address?: string;
    };
  };
}

const bookingId = route.params.id as string;
const booking = ref<BookingDetail | null>(null);


const loading = ref(false);

onMounted(async () => {
  loading.value = true;
  try {
    const res = await api.get(`/bookings/${bookingId}`);
    booking.value = res;
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div v-loading="loading" style="padding: 24px">
    <el-page-header content="Booking Detail" @back="$router.back()" />

    <el-card class="mt-4" v-if="booking">
      <template #header>
        <div class="flex justify-between items-center">
          <span>Booking Info</span>
          <el-button type="primary" @click="router.push(`/bookings/${booking.id}/edit`)">Edit</el-button>
        </div>
      </template>

      <el-descriptions :column="2" border>
        <el-descriptions-item label="Guest">{{ booking.guest.name }}</el-descriptions-item>
        <el-descriptions-item label="Contact">
          <div>{{ booking.guest.email || '-' }}</div>
          <div>{{ booking.guest.phone || '-' }}</div>
        </el-descriptions-item>

        <el-descriptions-item label="Check In">
          {{ dayjs(booking.checkIn).format('YYYY-MM-DD HH:mm') }}
        </el-descriptions-item>
        <el-descriptions-item label="Check Out">
          {{ dayjs(booking.checkOut).format('YYYY-MM-DD HH:mm') }}
        </el-descriptions-item>

        <el-descriptions-item label="Property">{{ booking.room.property.name }}</el-descriptions-item>
        <el-descriptions-item label="Room">{{ booking.room.label }}</el-descriptions-item>

        <el-descriptions-item label="Channel">{{ booking.channel }}</el-descriptions-item>
        <el-descriptions-item label="Confirmation Code">{{ booking.confirmationCode || '-' }}</el-descriptions-item>

        <el-descriptions-item label="Guest Total">
          <span v-if="booking.guestTotalCents != null">${{ (booking.guestTotalCents / 100).toFixed(2) }}</span>
          <span v-else>-</span>
        </el-descriptions-item>

        <el-descriptions-item label="Host Payout">
          <span v-if="booking.payoutCents != null">${{ (booking.payoutCents / 100).toFixed(2) }}</span>
          <span v-else>-</span>
        </el-descriptions-item>

        <el-descriptions-item label="Time Zone">{{ booking.tzSnapshot || '-' }}</el-descriptions-item>
        <el-descriptions-item label="Contract">
          <el-link v-if="booking.contractUrl" :href="booking.contractUrl" target="_blank">View</el-link>
          <span v-else>-</span>
        </el-descriptions-item>

        <el-descriptions-item label="Memo" :span="2">
          <div style="white-space: pre-line">{{ booking.memo || '-' }}</div>
        </el-descriptions-item>
      </el-descriptions>
    </el-card>
  </div>
</template>

<style scoped>
.mt-4 {
  margin-top: 16px;
}
</style>
