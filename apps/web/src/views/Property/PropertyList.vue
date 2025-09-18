<script setup lang="ts">
import { ref, onMounted, watch, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../../api';
import type { Paged, Property } from '../../types';
import PropertyLink from '../Property/PropertyLink.vue';

const router = useRouter();
const loading = ref(false);

const params = reactive({
  page: 1,
  pageSize: 20,
});

// ✅ 改为 reactive，模板中不用再 .value
const data = reactive<Paged<Property>>({
  page: 1,
  pageSize: 20,
  total: 0,
  rows: [],
});

async function load() {
  loading.value = true;
  try {
    const queryString = new URLSearchParams(params as any).toString();

    const res = await api.get(`/property?${queryString}`);
    console.log('API response:', res,params);

    if (res && typeof res === 'object') {
      Object.assign(data, res);
    } else {
      console.error("Unexpected response:", res);
    }
  } catch (err) {
    console.error("API Error:", err);
  } finally {
    loading.value = false;
  }

  
}


onMounted(load);
watch(() => [params.page, params.pageSize], load);
</script>

<template>
  <el-table :data="data.rows" v-loading="loading" border>
    <!-- <el-table-column prop="name" label="Name" sortable >
      <template #default="{ row }">
        <router-link :to="`/properties/${row.id}`" class="text-blue-500 hover:underline">
          {{ row.name || '-' }}
        </router-link>
        </template>
    </el-table-column> -->

    <el-table-column label="Name">
      <template #default="{ row }">
        <PropertyLink :property="row" />
      </template>
    </el-table-column>
    <el-table-column prop="address" label="Address" sortable />
    <el-table-column label="Room Count" width="120">
      <template #default="{ row }">
        {{ row.rooms?.length || 0 }}
      </template>
    </el-table-column>
  </el-table>

  <div class="mt-3 flex justify-end">
    <el-pagination
      layout="prev, pager, next, sizes, total"
      :page-sizes="[10, 20, 50, 100]"
      :current-page="data?.page || 1"
      :page-size="data?.pageSize || 20"
      :total="data?.total || 0"

      @current-change="(val) => params.page = val"
      @size-change="(val) => { params.pageSize = val; params.page = 1 }"
    />
  </div>
</template>

<style scoped>
.mt-3 { margin-top: 12px; }
.flex { display: flex; }
.justify-end { justify-content: flex-end; }
</style>
