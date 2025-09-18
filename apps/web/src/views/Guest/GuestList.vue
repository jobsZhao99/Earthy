<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../../api';
import type { Guest } from '../../types';

const router = useRouter();
const loading = ref(false);
const guests = ref<Guest[]>([]);
const search = ref('');

const currentPage = ref(1);
const pageSize = ref(20);
const totalGuests = ref(0);

async function loadGuests() {
  loading.value = true;
  try {
    const query = new URLSearchParams({
      page: currentPage.value.toString(),
      pageSize: pageSize.value.toString(),
      includeBookingCount: 'true',
      search: search.value.trim()
    }).toString();

    const res = await api.get(`/guest?${query}`);
    guests.value = res.rows ?? [];
    totalGuests.value = res.total ?? 0;
  } finally {
    loading.value = false;
  }
}

onMounted(loadGuests);

// 监听分页或 pageSize 改变自动加载
watch([currentPage, pageSize], loadGuests);

// 搜索时手动触发（并重置页码）
function handleSearch() {
  currentPage.value = 1;
  loadGuests();
}

function goToDetail(id: string) {
  router.push(`/guest/${id}`);
}
</script>

<template>
  <el-card shadow="never">
    <template #header>
        <div class="flex items-center justify-between">
            <div class="text-lg font-semibold">Guests</div>
            <div class="flex items-center gap-2">
                <el-input
                v-model="search"
                placeholder="Search name, email, or phone"
                clearable
                style="width: 300px"
                @keydown.enter="handleSearch"
                @clear="handleSearch"
                />
            <el-button type="primary" @click="handleSearch">Search</el-button>
            </div>
        </div>
    </template>

    <el-table :data="guests" v-loading="loading" style="width: 100%">
      <el-table-column label="Name" prop="name" />
      <el-table-column label="Phone" prop="phone" />
      <el-table-column label="Email" prop="email" />
      <el-table-column label="Bookings">
        <template #default="{ row }">
          {{ row._count?.bookings ?? row.bookingCount ?? '-' }}
        </template>
      </el-table-column>
      <el-table-column label="Actions" width="120">
        <template #default="{ row }">
          <el-button type="primary" size="small" @click="goToDetail(row.id)">View</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="mt-4 flex justify-center">
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :total="totalGuests"
        layout="total, sizes, prev, pager, next, jumper"
        :page-sizes="[10, 20, 50, 100, 1000]"
      />
    </div>
  </el-card>
</template>
