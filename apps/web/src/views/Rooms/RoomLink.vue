<script setup lang="ts">
import { defineProps } from 'vue';

const props = defineProps<{
  room: { id: string, label: string }
}>();
</script>

<template>
  <router-link :to="`/rooms/${room.id}`">
    {{ room.label }}
  </router-link>
</template>
