<script setup lang="ts">
import { ref, onMounted, watch, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../../api';
import type { Paged, Property } from '../../types';

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

    const res = await api.get(`/properties?${queryString}`);
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
    <el-table-column label="Actions" width="150">
      <template #default="{ row }">
        <el-button size="small" type="primary" @click="router.push(`/properties/${row.id}`)">
          View Detail
        </el-button>
      </template>
    </el-table-column>
    <el-table-column prop="name" label="Name" />
    <el-table-column prop="address" label="Address" />
    <el-table-column prop="timezone" label="Timezone" width="220" />
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
