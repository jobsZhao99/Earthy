<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from '../../api';
import { DateTime } from 'luxon';

const loading = ref(false);

const today = DateTime.local();
const defaultFrom = today.minus({ months: 6 }).startOf('month');
const defaultTo = today.plus({ months: 6 }).startOf('month');

const from = ref(defaultFrom.toFormat('yyyy-MM'));
const to = ref(defaultTo.toFormat('yyyy-MM'));
const data = ref<any[]>([]);

async function load() {
  loading.value = true;
  const res = await api.get('/reports/ledger-summary?' + new URLSearchParams({
    from: from.value,
    to: to.value,
  }));
  data.value = res.rows ?? res ?? [];
  loading.value = false;
}

onMounted(load);
</script>

<template>
  <div class="flex items-center gap-3 mb-4">
    <el-date-picker
      v-model="from"
      type="month"
      placeholder="From"
      format="YYYY-MM"
      value-format="YYYY-MM"
      @change="load"
    />
    <el-date-picker
      v-model="to"
      type="month"
      placeholder="To"
      format="YYYY-MM"
      value-format="YYYY-MM"
      @change="load"
    />
  </div>

  <el-table :data="data" v-loading="loading" border>
    <el-table-column label="Ledger Name" prop="ledgerName" />
    <el-table-column label="Total Amount" :formatter="row => '$' + (row.amountCents / 100).toFixed(2)" />
    <el-table-column label="Transactions" prop="count" />
  </el-table>
</template>
