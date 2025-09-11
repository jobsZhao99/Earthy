<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '../../api';
import type { Guest, BookingRecord } from '../../types';
import { DateTime } from 'luxon';
import PropertyLink from '../Properties/PropertyLink.vue';
import RoomLink from '../Rooms/RoomLink.vue';


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
  // const b = await api.get(`/guests/${guestId}/bookings`);
  guest.value = g;
  bookings.value = (g.bookings ?? []).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  loading.value = false;
}


const earliestCheckIn = computed(() => {
  return bookings.value.length
    ? DateTime.fromISO(
      bookings.value
        .filter(b => b.checkIn)
        .map(b => b.checkIn)
        .sort()[0]
    ).toFormat('yyyy-LL-dd')
    : '';
});

const latestCheckOut = computed(() => {
  return bookings.value.length
    ? DateTime.fromISO(
      bookings.value
        .filter(b => b.checkOut)
        .map(b => b.checkOut)
        .sort()
        .slice(-1)[0]
    ).toFormat('yyyy-LL-dd')
    : '';
});
const totalPayout = computed(() => {
  return (
    bookings.value.reduce((sum, b) => sum + (b.payoutCents ?? 0), 0) / 100
  ).toFixed(2);
});

const totalGuestPay = computed(() => {
  return (
    bookings.value.reduce((sum, b) => sum + (b.guestTotalCents ?? 0), 0) / 100
  ).toFixed(2);
});

onMounted(() => {
  load();
});

// 🏷️ 标签逻辑
const guestTag = computed(() => {
  if (!bookings.value.length) return 'Past Guest';

  const statuses = bookings.value.map(b => b.status);

  if (statuses.includes('CHECKED_IN')) {
    return 'Current Tenant';
  } else if (statuses.every(s => s === 'FUTURE')) {
    return 'Future';
  } else {
    return 'Past Guest';
  }
});

// 🖌️ 标签颜色
const tagType = computed(() => {
  switch (guestTag.value) {
    case 'Current Tenant':
      return 'success';  // 绿色
    case 'Future':
      return 'info';     // 蓝色
    case 'Past Guest':
      return 'warning';  // 橙色/灰色
    default:
      return 'default';
  }
});
</script>


<template>
  <div v-if="guest">
    <h2 class="text-xl font-bold mb-2">
      Guest: {{ guest.name }}
      <el-tag v-if="guestTag" :type="tagType" size="small" effect="light" class="ml-2">
        {{ guestTag }}
      </el-tag>
    </h2>
    <el-card shadow="never" class="mb-4">
      <el-descriptions title="Guest Info" column="2" border>
        <el-descriptions-item label="Email">
          {{ guest.email }}
        </el-descriptions-item>
        <el-descriptions-item label="Phone">
          {{ guest.phone }}
        </el-descriptions-item>

        <el-descriptions-item label="Earliest Check-in">
          {{ earliestCheckIn }}
        </el-descriptions-item>
        <el-descriptions-item label="Latest Check-out">
          {{ latestCheckOut }}
        </el-descriptions-item>
        <el-descriptions-item label="Total Payout">
          ${{ totalPayout }}
        </el-descriptions-item>
        <el-descriptions-item label="Total Guest Paid">
          ${{ totalGuestPay }}
        </el-descriptions-item>
        <el-descriptions-item label="Created At">
          {{ fmt(guest.createdAt) }}
        </el-descriptions-item>
      </el-descriptions>
    </el-card>



    <el-divider>Bookings</el-divider>

    <el-table :data="bookings" v-loading="loading" border>
      <el-table-column label="Confirm Date" prop="createdAt" :formatter="(row) => fmt(row?.createdAt)" sortable />
      <el-table-column label="Property">
        <template #default="{ row }">
          <PropertyLink :property="row.room.property" />
        </template>
      </el-table-column>
      <el-table-column label="Room">
        <template #default="{ row }">
          <RoomLink :room="row.room" />
        </template>
      </el-table-column>
      <el-table-column label="Cleaning Status" prop="room.cleaningStatus" />

      <el-table-column label="Confirmation Code" prop="confirmationCode" />
      <el-table-column label="Check In" :formatter="row => fmt(row.checkIn)" />
      <el-table-column label="Check Out" :formatter="row => fmt(row.checkOut)" />
      <el-table-column label="Channel" prop="channel" />
      <el-table-column label="Status" prop="status" />
      <el-table-column label="Payout" :formatter="(row) => {
        // console.log('💰 payout row:', row);
        return row?.payoutCents != null ? '$' + (row.payoutCents / 100).toFixed(2) : '';
      }" />

      <el-table-column label="Guest Total"
        :formatter="(row) => row?.guestTotalCents != null ? '$' + (row.guestTotalCents / 100).toFixed(2) : ''" />
    </el-table>
  </div>
</template>