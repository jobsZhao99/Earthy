<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { api } from "../../api";
import type { Booking, BookingRecord } from "../../types";
// import { DateTime } from "luxon";
import { toDateStr } from "../../utils/date.js";

const route = useRoute();
const router = useRouter();

const loading = ref(false);
const booking = ref<Booking | null>(null);

// function fmtDate(dt?: string | null) {
//   if (!dt) return "";
//   return DateTime.fromISO(dt).toFormat("yyyy-LL-dd");
// }

async function load() {
  loading.value = true;
  try {
    const id = route.params.id as string;
    const res = await api.get(`/booking/${id}`);
    booking.value = res;
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div v-if="loading">Loading…</div>

  <div v-else-if="!booking">Not Found</div>

  <div v-else class="space-y-4">
    <!-- 顶部信息 -->
    <el-card>
      <h2 class="text-lg font-bold mb-2">Booking Detail</h2>
      <p><b>Status:</b> {{ booking.status }}</p>
      <p><b>Guest:</b>
        <router-link
          :to="`/guest/${booking.guestId}`"
          class="text-blue-500 hover:underline"
        >
          {{ booking.guest?.name || "-" }}
        </router-link>
      </p>
      <p><b>Property:</b> {{ booking.room?.property?.name }}</p>
      <p><b>Room:</b> {{ booking.room?.label }}</p>
      <p><b>Channel:</b> {{ booking.channel?.label }}</p>
      <p><b>External Ref:</b> {{ booking.externalRef || "-" }}</p>
      <p><b>Check In:</b> {{ toDateStr(booking.checkIn )}}</p>
      <p><b>Check Out:</b> {{ toDateStr(booking.checkOut) }}</p>
      <p><b>Payout:</b>
        {{ booking.payoutCents != null ? "$" + (booking.payoutCents / 100).toFixed(2) : "-" }}
      </p>
      <p><b>Guest Total:</b>
        {{ booking.guestTotalCents != null ? "$" + (booking.guestTotalCents / 100).toFixed(2) : "-" }}
      </p>
      <p><b>Memo:</b> {{ booking.memo || "-" }}</p>
    </el-card>

    <!-- 关联 Booking Records -->
    <el-card>
      <h2 class="text-lg font-bold mb-2">Booking Records</h2>
      <el-table :data="booking.bookingRecords" border>
        <el-table-column prop="type" label="Type" width="150" />
        <el-table-column
          prop="rangeStart"
          label="From"
          :formatter="(row) => toDateStr(row.rangeStart)"
          width="140"
        />
        <el-table-column
          prop="rangeEnd"
          label="To"
          :formatter="(row) => toDateStr(row.rangeEnd)"
          width="140"
        />
        <el-table-column
          label="Guest Δ"
          :formatter="(row) =>
            row.guestDeltaCents != null ? '$' + (row.guestDeltaCents / 100).toFixed(2) : ''
          "
          width="120"
        />
        <el-table-column
          label="Payout Δ"
          :formatter="(row) =>
            row.payoutDeltaCents != null ? '$' + (row.payoutDeltaCents / 100).toFixed(2) : ''
          "
          width="120"
        />
        <el-table-column
          prop="createdAt"
          label="Created At"
          :formatter="(row) => toDateStr(row.createdAt)"
          width="160"
        />
        <el-table-column prop="memo" label="Memo" />
      </el-table>
    </el-card>

    <div class="mt-4">
      <el-button @click="router.back()">Back</el-button>
    </div>
  </div>
</template>

<style scoped>
.space-y-4 > * + * {
  margin-top: 1rem;
}
</style>
