<script setup lang="ts">
import { defineProps } from 'vue';

const props = defineProps<{
  property: { id: string, name: string }
}>();
</script>

<template>
  <router-link :to="`/property/${property.id}`">
    {{ property.name }}
  </router-link>
</template>
