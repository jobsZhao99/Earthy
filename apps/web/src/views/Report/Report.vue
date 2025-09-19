<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { api } from '../../api';
import { DateTime } from 'luxon';

const loading = ref(false);

// 默认时间范围：前6个月到后6个月
const today = DateTime.local();
const defaultFrom = today.minus({ months: 6 }).startOf('month');
const defaultTo = today.plus({ months: 6 }).startOf('month');

const from = ref(defaultFrom.toFormat('yyyy-MM'));
const to = ref(defaultTo.toFormat('yyyy-MM'));
const data = ref<any[]>([]);

// 生成 from 到 to 之间的月份列表
const months = computed(() => {
  const result: string[] = [];
  let d = DateTime.fromFormat(from.value, 'yyyy-MM');
  const end = DateTime.fromFormat(to.value, 'yyyy-MM');
  console.log('Generating months from', d.toISODate(), 'to', end.toISODate());
  while (d <= end) {
    result.push(d.toFormat('yyyy-MM'));
    d = d.plus({ months: 1 });
  }
  return result;
});

async function load() {
  loading.value = true;
  const res = await api.get('/report/ledger-summary?' + new URLSearchParams({
    from: from.value,
    to: to.value,
  }));
  data.value = res.rows ?? res ?? [];
  loading.value = false;
}


watch([from, to], load);

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
    />
    <el-date-picker
      v-model="to"
      type="month"
      placeholder="To"
      format="YYYY-MM"
      value-format="YYYY-MM"
    />
  </div>

  <el-table :data="data" v-loading="loading" border style="width: 100%">
    <el-table-column label="Ledger Name" prop="ledgerName" fixed />
    
    <el-table-column
      v-for="month in months"
      :key="month"
      :label="month"
      :prop="'monthly.' + month"
      :formatter="(_, __, val) => val ? ('$' + (val / 100).toFixed(2)) : ''"
    />
  </el-table>
</template>

<style scoped>
.el-date-picker {
  max-width: 160px;
}
</style>
