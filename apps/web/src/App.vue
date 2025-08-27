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
  <h1>Earthy Demo</h1>
  <pre>Health: {{ health }}</pre>
  <button @click="createDemo">Create Booking (demo)</button>
  <ul>
    <li v-for="b in bookings" :key="b.id">
      {{ b.id }} — {{ b.channel }} — {{ b.checkIn }} → {{ b.checkOut }}
    </li>
  </ul>
</template>
