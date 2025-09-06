<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from '../../api/client';
import type { Property } from '../../types';

const data = ref<{ rows: Property[] }>({ rows: [] });
const loading = ref(false);

async function load() {
  loading.value = true;
  try {
    const res = await api.get('/properties', { params: { pageSize: 500 } });
    data.value.rows = res.data.rows ?? res.data ?? [];
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <el-table :data="data.rows" v-loading="loading" border>
    <el-table-column prop="name" label="Name" />
    <el-table-column prop="address" label="Address" />
    <el-table-column prop="timezone" label="Timezone" width="220" />
  </el-table>
</template>
