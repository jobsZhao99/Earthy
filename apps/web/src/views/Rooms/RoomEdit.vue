<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../../api'
import type { Room } from '../../types'

const route = useRoute()
const router = useRouter()
const roomId = route.params.id as string

const room = ref<Room | null>(null)
const loading = ref(true)
const saving = ref(false)

async function loadRoom() {
  loading.value = true
  try {
    const res = await api.get(`/rooms/${roomId}`)
    room.value = res
  } finally {
    loading.value = false
  }
}

async function saveRoom() {
  if (!room.value) return
  saving.value = true
  try {
    await api.put(`/rooms/${roomId}`, room.value)
    router.push(`/rooms/${roomId}`)
  } finally {
    saving.value = false
  }
}

onMounted(loadRoom)
</script>

<template>
  <div v-if="loading" class="text-gray-500">Loading...</div>

  <div v-else-if="room">
    <h1 class="text-2xl font-bold mb-4">Edit Room</h1>

    <el-form :model="room" label-width="120px">
      <el-form-item label="Label">
        <el-input v-model="room.label" />
      </el-form-item>

      <el-form-item label="Nightly Rate (USD)">
        <el-input-number
          v-model="room.nightlyRateCents"
          :min="0"
          :step="100"
          :formatter="val => `$${(val / 100).toFixed(2)}`"
          :parser="val => parseFloat(val.replace(/\$/g, '')) * 100"
        />
      </el-form-item>

      <el-form-item label="Status">
        <el-select v-model="room.cleaningStatus" placeholder="Select">
          <el-option label="Dirty" value="DIRTY" />
          <el-option label="Occupied" value="OCCUPIED" />
          <el-option label="Clean" value="CLEAN" />
          <el-option label="On Hold" value="ON_HOLD" />
          <el-option label="Cleaning Scheduled" value="CLEANING_SCHEDULED" />
        </el-select>
      </el-form-item>

      <el-form-item>
        <el-button type="primary" @click="saveRoom" :loading="saving">Save</el-button>
        <el-button @click="router.back()">Cancel</el-button>
      </el-form-item>
    </el-form>
  </div>
</template>
