<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';

const searchQuery = ref('');
const router = useRouter();

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
</script>

<template>
  <el-container style="min-height: 100vh">
    <!-- 左侧菜单 -->
    <el-aside width="200px" style="background-color: #f5f5f5; border-right: 1px solid #ddd;">
      <el-menu default-active="/" class="el-menu-vertical" router>
        <el-menu-item index="/today-bookings">Today</el-menu-item>
        <el-menu-item index="/">Bookings</el-menu-item>
        <el-menu-item index="/properties">Properties</el-menu-item>
        <el-menu-item index="/guests">Guests</el-menu-item>
        <el-menu-item index="/report">Report</el-menu-item>
        <el-menu-item index="/property-report">Property Report</el-menu-item>
      </el-menu>
    </el-aside>

    <!-- 右侧内容 -->
    <el-container>
      <!-- 顶部导航栏 -->
      <el-header height="60px" class="header-bar">
        <el-button type="primary" link @click="goBack" class="mr-4">
          ← Back
        </el-button>

        <el-input
          v-model="searchQuery"
          placeholder="Search Booking / Property / Room / Guest"
          clearable
          @keyup.enter.native="handleSearch"
          style="max-width: 400px"
        >
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
