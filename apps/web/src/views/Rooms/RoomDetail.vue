<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../../api'
import type { Room } from '../../types'
import { DateTime } from 'luxon'

const route = useRoute()
const router = useRouter()
const roomId = route.params.id as string

const room = ref<Room | null>(null)
const loading = ref(true)

function fmt(dt: string) {
  return DateTime.fromISO(dt).toFormat('yyyy-LL-dd HH:mm')
}

async function loadRoom() {
  loading.value = true
  try {
    const res = await api.get(`/rooms/${roomId}`)
    room.value = res
  } finally {
    loading.value = false
  }
}

onMounted(loadRoom)

function goEdit() {
  router.push(`/rooms/${roomId}/edit`)
}
</script>

<template>
  <div v-if="loading" class="text-gray-500">Loading...</div>

  <div v-else-if="room">
    <h1 class="text-2xl font-bold mb-4">
      Room: {{ room.label }}
    </h1>

    <el-card shadow="never" class="mb-4">
      <el-descriptions title="Room Info" column="2" border>
        <el-descriptions-item label="Property">
          {{ room.property?.name }}
        </el-descriptions-item>
        <el-descriptions-item label="Nightly Rate">
          {{ room.nightlyRateCents ? '$' + (room.nightlyRateCents / 100).toFixed(2) : '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="Status">
          {{ room.cleaningStatus }}
        </el-descriptions-item>
        <el-descriptions-item label="Created At">
          {{ fmt(room.createdAt) }}
        </el-descriptions-item>
        <el-descriptions-item label="Updated At">
          {{ fmt(room.updatedAt) }}
        </el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-button type="primary" @click="goEdit">Edit</el-button>
  </div>
</template>
