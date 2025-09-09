<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { api } from '../../api';
import { DateTime } from 'luxon';

const loading = ref(false);
const data = ref<any[]>([]);

// 默认时间范围：前6个月到后6个月
const today = DateTime.local();
const defaultFrom = today.minus({ months: 6 }).startOf('month');
const defaultTo = today.plus({ months: 6 }).startOf('month');

const from = ref(defaultFrom.toFormat('yyyy-MM'));
const to = ref(defaultTo.toFormat('yyyy-MM'));

// 获取所有物业
const allProperties = ref<{ id: string; name: string }[]>([]);
const selectedProperties = ref<string[]>([]);

async function fetchProperties() {
  const res = await api.get('/propertieslist');
  allProperties.value = res ?? [];
}

// 生成月份列表
const months = computed(() => {
  const result: string[] = [];
  let d = DateTime.fromFormat(from.value, 'yyyy-MM');
  const end = DateTime.fromFormat(to.value, 'yyyy-MM');
  while (d <= end) {
    result.push(d.toFormat('yyyy-MM'));
    d = d.plus({ months: 1 });
  }
  return result;
});

async function load() {
  loading.value = true;
  const params: any = {
    from: from.value,
    to: to.value,
  };
  if (selectedProperties.value.length) {
    params.propertyIds = selectedProperties.value.join(',');
  }

  const res = await api.get('/reports-multi-properties?' + new URLSearchParams(params));
  data.value = res.rows ?? res ?? [];
  loading.value = false;
}

// watch([from, to, selectedProperties], load);
onMounted(() => {
  fetchProperties();
  // load();
});
</script>

<template>
  <div class="flex items-center gap-3 mb-4 flex-wrap">
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
    <el-select
      v-model="selectedProperties"
      multiple
      collapse-tags
      placeholder="Select Properties"
      clearable
      style="min-width: 300px"
    >
      <el-option
        v-for="p in allProperties"
        :key="p.id"
        :label="p.name"
        :value="p.id"
      />
    </el-select>
    <el-button type="primary" @click="load">确认查询</el-button>

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
