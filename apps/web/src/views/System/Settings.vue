<script setup lang="ts">
import { ref, onMounted } from "vue";
import { api } from "../../api";
import { ElMessage } from "element-plus";

const colors = ref<{ [k: string]: string }>({});

async function loadSettings() {
  const res = await api.get("/settings/roomColors");
  if (!res || Object.keys(res).length === 0) {
    // 默认值
    colors.value = {
      current: "#3B82F6", // 蓝色：当前入住
      future: "#FACC15", // 黄色：未来预订
      empty: "#22C55E",  // 绿色：空房
    };
  } else {
    colors.value = res;
  }
}

async function saveSettings() {
  await api.post("/settings/roomColors", colors.value);
  ElMessage.success("颜色设置已保存");
}

onMounted(loadSettings);
</script>

<template>
  <el-card>
    <template #header>系统设置</template>

    <div>
      <h3>房间颜色配置</h3>
      <div v-for="(color, key) in colors" :key="key" style="margin:12px 0;">
        <span style="width:120px;display:inline-block;">{{ key }}</span>
        <el-color-picker v-model="colors[key]" />
        <span style="margin-left:8px;">{{ colors[key] }}</span>
      </div>
    </div>

    <el-divider />

    <el-button type="primary" @click="saveSettings">保存</el-button>
  </el-card>
</template>
