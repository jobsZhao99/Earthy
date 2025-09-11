<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
// import { Fold, Expand } from '@element-plus/icons-vue'import { Calendar, List, House, User, PieChart, Document, } from '@element-plus/icons-vue'
import { Icon } from '@iconify/vue'


const searchQuery = ref('');
const router = useRouter();
const isCollapse = ref(true) // 👉 默认收起

function handleSearch() {
  const query = searchQuery.value.trim();
  if (!query) return;
  router.push({ path: '/search', query: { q: query } });
}

function goBack() {
  router.back();
}

function goForward() {
  router.forward();
}
function toggleMenu() {
  isCollapse.value = !isCollapse.value
}
</script>

<template>
  <el-container style="min-height: 100vh">
    <!-- 左侧菜单 -->
    <el-aside :width="isCollapse ? '64px' : '200px'" style="background-color: #f5f5f5; border-right: 1px solid #ddd;">
      <el-menu default-active="/" class="el-menu-vertical" router :collapse="isCollapse">

                <!-- 展开/收起按钮 -->
        <div style="display: flex; justify-content: center;">
          <el-button text circle size="large" @click="toggleMenu">
            <el-icon>
              <Icon icon="mdi:expand-all" v-if="isCollapse" />
              <Icon icon="mdi:collapse-all" v-else />
            </el-icon>
          </el-button>
        </div>
        <el-menu-item index="/today-bookings">
          <el-icon><Icon icon="mdi:home-time-outline" /></el-icon>

          <span>Today</span>
        </el-menu-item>

        <el-menu-item index="/">
          <el-icon><Icon icon="mdi:calendar-check-outline" /></el-icon>

          <span>Bookings</span>
        </el-menu-item>

        <el-menu-item index="/properties">
          <el-icon><Icon icon="mdi:house-city-outline" /></el-icon>
          <span>Properties</span>
        </el-menu-item>

        <el-menu-item index="/guests">
          <el-icon><Icon icon="mdi:people-outline" /></el-icon>
          <span>Guests</span>
        </el-menu-item>

        <el-menu-item index="/report">
          <el-icon><Icon icon="mdi:report-line" /></el-icon>
          <span>Report</span>
        </el-menu-item>

        <el-menu-item index="/property-report">
          <el-icon><Icon icon="mdi:report-box-multiple-outline" /></el-icon>
          <span>Property Report</span>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <!-- 右侧内容 -->
    <el-container>
      <!-- 顶部导航栏 -->
      <el-header height="60px" class="header-bar">
        <el-button type="primary" link @click="goBack" class="mr-4">
          ← Back
        </el-button>

        <el-input v-model="searchQuery" placeholder="Search Booking / Property / Room / Guest" clearable
          @keyup.enter.native="handleSearch" style="max-width: 400px">
          <template #append>
            <el-button icon="el-icon-search" @click="handleSearch" />
          </template>
        </el-input>
        <el-button type="primary" link @click="goForward" class="mr-4">
          → forward
        </el-button>

      </el-header>

      <!-- 主内容区 -->
      <el-main class="main-content">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<style scoped>
.header-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
  background: white;
  border-bottom: 1px solid #eee;
}

.main-content {
  padding: 16px;
  background: #fafafa;
}
</style>
