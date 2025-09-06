<script setup lang="ts">
import { ref, onMounted } from "vue";
import { api } from "./api";

const health = ref<any>(null);
const bookings = ref<any[]>([]);

onMounted(async () => {
  health.value = await fetch((import.meta.env.VITE_API_BASE || "/api") + "/../healthz").then(r => r.json()).catch(() => null);
  bookings.value = await api("/bookings");
});

async function createDemo() {
  // 先假数据：需要先在数据库插入1个property/room/guest 或做个后端seed
  const demo = await api("/bookings", {
    method: "POST",
    body: JSON.stringify({
      roomId: "ROOM_ID_REPLACE",
      guestId: "GUEST_ID_REPLACE",
      channel: "DIRECT",
      checkIn: new Date().toISOString(),
      checkOut: new Date(Date.now()+86400000).toISOString()
    })
  });
  bookings.value.push(demo);
}
</script>

<template>
  <el-container style="min-height: 100vh">
    <el-header>
      <el-menu mode="horizontal" router>
        <el-menu-item index="/">Bookings</el-menu-item>
        <el-menu-item index="/properties">Properties</el-menu-item>
        <el-menu-item index="/reports">Reports</el-menu-item>
      </el-menu>
    </el-header>
    <el-main>
      <router-view />
    </el-main>
  </el-container>
</template>

