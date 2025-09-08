<script setup lang="ts">
    import { ref, onMounted } from 'vue';
    import { api } from '../../api';
    import { DateTime } from 'luxon';

    const loading = ref(false);
    const year = ref(DateTime.local().year);
    const month = ref(DateTime.local().month);
    const ledgers = ref([]);
    const data = ref([]);

    async function load() {
    loading.value = true;
    const res = await api.get('/reports/ledger-summary?' + new URLSearchParams({
        year: year.value.toString(),
        month: month.value.toString(),
    }));
    data.value = res.rows ?? res ?? [];
    loading.value = false;
    }

    onMounted(load);
</script>

<template>
    <div class="flex items-center gap-3 mb-4">
      <el-select v-model="year" @change="load">
        <el-option v-for="y in [2024, 2025, 2026]" :label="y" :value="y" />
      </el-select>
      <el-select v-model="month" @change="load">
        <el-option v-for="m in Array.from({length:12}, (_,i)=>i+1)" :label="m" :value="m" />
      </el-select>
    </div>
  
    <el-table :data="data" v-loading="loading" border>
      <el-table-column label="Ledger Name" prop="ledgerName" />
      <el-table-column label="Total Amount" :formatter="row => '$' + (row.amountCents / 100).toFixed(2)" />
      <el-table-column label="Transactions" prop="count" />
    </el-table>
  </template>
  
