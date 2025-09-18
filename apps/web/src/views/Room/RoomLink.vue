<script setup lang="ts">
import { defineProps } from 'vue';

const props = defineProps<{
  room: { id: string, label: string }
}>();
</script>

<template>
  <router-link :to="`/room/${room.id}`">
    {{ room.label }}
  </router-link>
</template>
