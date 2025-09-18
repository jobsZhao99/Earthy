<script setup lang="ts">
  import { ref, onMounted, watch } from 'vue';
  import { api } from '../../../api';
  import type { Paged, BookingRecord, Property } from '../../../types';
  import { DateTime } from 'luxon';
  import { useRouter } from 'vue-router';
import { channel } from 'diagnostics_channel';

  const router = useRouter();
  const loading = ref(false);
  // 计算日期区间
  const today = DateTime.now();
  const defaultFrom = today.minus({ days: 15 }).toFormat('yyyy-LL-dd');
  const defaultTo = today.plus({ days: 15 }).toFormat('yyyy-LL-dd');

  const q = ref({
    propertyId: '',
    from: defaultFrom,
    to: defaultTo,
    page: 1,
    channel: '',
    pageSize: 1000,
  });

  const properties = ref<Property[]>([]);
  const data = ref<Paged<BookingRecord>>({ page:1, pageSize:1000, total:0, rows:[] });

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
      // console.log("✅ /bookings response:", res); // 👈 加这行看看字段结构

      data.value = res;
    } finally {
      loading.value = false;
    }
  }

  function fmtDate(dt: string) {
    return DateTime.fromISO(dt).toFormat('yyyy-LL-dd');
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
    <el-select v-model="q.channel" placeholder="Channel" clearable filterable style="width:280px">
      <el-option v-for="p in properties" :key="p.id" :label="p.name" :value="p.id" />
    </el-select>


    <el-button type="primary" @click="router.push('/bookings/new')">New Booking</el-button>
  </div>

  <el-table :data="data.rows" v-loading="loading" border>
    <!-- <el-table-column label="Actions" width="80">
      <template #default="{ row }">
        <el-button size="small" type="primary" @click="router.push(`/bookings/${row.id}/edit`)">
          Edit
        </el-button>
      </template>
    </el-table-column> -->
    <el-table-column label="Status" prop="status" sortable width="180"/>
    <el-table-column label="Confirm Date" prop="createdAt" :formatter="(row) => fmtDate(row?.createdAt)" sortable
      width="180"
    />
    <el-table-column label="Property" prop="room.property.name" sortable width="240" />
    <el-table-column label="Room" prop="room.label" sortable width="120" />
    <el-table-column label="Guest" prop="guest.name" sortable width="160" >
      <template #default="{ row }">
        <router-link :to="`/guests/${row.guestId}`" class="text-blue-500 hover:underline">
          {{ row.guest?.name || '-' }}
        </router-link>
      </template>
    </el-table-column>
    <el-table-column label="Confirmation Code" prop="confirmationCode" width="160">
      <template #default="{ row }">
        <router-link :to="`/bookings/${row.id}`" class="text-blue-500 hover:underline">
          {{ row.confirmationCode || '-' }}
        </router-link>
      </template>
    </el-table-column>
    <el-table-column label="Check In" prop="checkIn" sortable width="180" />
    <el-table-column label="Check Out" prop="checkOut" sortable width="180" />
    <el-table-column label="Channel" prop="channel" sortable width="130" />
    <el-table-column
      label="Payout"
      :formatter="(row) => {
        // console.log('💰 payout row:', row);
        return row?.payoutCents != null ? '$' + (row.payoutCents / 100).toFixed(2) : '';
      }"
      width="120"
    />

    <el-table-column
      label="Guest Total"
      :formatter="(row) => row?.guestTotalCents != null ? '$' + (row.guestTotalCents / 100).toFixed(2) : ''"
      width="120"
    />
  </el-table>

  <div class="mt-3 flex justify-end">
    <el-pagination
      layout="prev, pager, next, sizes, total"
      :page-sizes="[10,20,50,100,1000]"
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
