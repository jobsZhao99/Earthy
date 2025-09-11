<script setup lang="ts">
import { defineProps } from 'vue';

const props = defineProps<{
  guest: { id: string, name: string }
}>();
</script>

<template>
  <router-link :to="`/guest/${guest.id}`">
    {{ guest.name }}
  </router-link>
</template>
