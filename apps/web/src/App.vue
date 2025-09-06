<script setup lang="ts">
import { ref, onMounted } from "vue";
import { api } from "./api";

const API_BASE = import.meta.env.VITE_API_BASE?.replace(/\/$/, "") || "/api";
console.log("API_BASE", API_BASE);
const health = ref<any>(null);
const bookings = ref<any[]>([]);

onMounted(async () => {
  health.value = await fetch(`${API_BASE}/healthz`).then(r => r.json()).catch(() => null);
  bookings.value = await api.get("/bookings");
});
</script>

<template>
  <el-container style="min-height: 100vh">
    <el-header>
      <el-menu mode="horizontal" router>
        <!-- <el-menu-item index="/">Bookings</el-menu-item> -->
        <!-- <el-menu-item index="/properties">Properties</el-menu-item> -->
        <!-- <el-menu-item index="/reports">Reports</el-menu-item> -->
      </el-menu>
    </el-header>
    <el-main>
      <router-view />
    </el-main>
  </el-container>
</template>
