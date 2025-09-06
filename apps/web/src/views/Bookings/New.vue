<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from '../../api/client';
import type { Property, Room, Guest } from '../../types';
import { useRouter } from 'vue-router';

const router = useRouter();
const form = ref({
  propertyId: '',
  roomId: '',
  guestId: '',
  checkIn: '',
  checkOut: '',
  channel: 'DIRECT',
  payoutCents: null as number | null,
  guestTotalCents: null as number | null,
  confirmationCode: '',
  contractUrl: ''
});

const properties = ref<Property[]>([]);
const rooms = ref<Room[]>([]);
const guests = ref<Guest[]>([]);
const loading = ref(false);

async function loadProperties() {
  const res = await api.get('/properties', { params: { pageSize: 500 } });
  properties.value = res.data.rows ?? res.data ?? [];
}
async function loadRooms() {
  rooms.value = [];
  if (!form.value.propertyId) return;
  const res = await api.get('/rooms', { params: { propertyId: form.value.propertyId, pageSize: 500 } });
  rooms.value = res.data.rows ?? res.data ?? [];
}
async function loadGuests() {
  const res = await api.get('/guests', { params: { pageSize: 500 } });
  guests.value = res.data.rows ?? res.data ?? [];
}

async function submit() {
  loading.value = true;
  try {
    const payload = {
      roomId: form.value.roomId,
      guestId: form.value.guestId,
      checkIn: form.value.checkIn,
      checkOut: form.value.checkOut,
      channel: form.value.channel,
      payoutCents: form.value.payoutCents ? Number(form.value.payoutCents) : null,
      guestTotalCents: form.value.guestTotalCents ? Number(form.value.guestTotalCents) : null,
      confirmationCode: form.value.confirmationCode || null,
      contractUrl: form.value.contractUrl || null
    };
    await api.post('/bookings', payload); // 后端已自动过账
    ElMessage.success('Created');
    router.push('/');
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  await loadProperties();
  await loadGuests();
});
</script>

<template>
  <el-form label-width="120">
    <el-form-item label="Property">
      <el-select v-model="form.propertyId" placeholder="Select property" @change="loadRooms" filterable>
        <el-option v-for="p in properties" :key="p.id" :label="p.name" :value="p.id" />
      </el-select>
    </el-form-item>

    <el-form-item label="Room">
      <el-select v-model="form.roomId" placeholder="Select room" filterable>
        <el-option v-for="r in rooms" :key="r.id" :label="r.label" :value="r.id" />
      </el-select>
    </el-form-item>

    <el-form-item label="Guest">
      <el-select v-model="form.guestId" placeholder="Select guest" filterable>
        <el-option v-for="g in guests" :key="g.id" :label="g.name" :value="g.id" />
      </el-select>
    </el-form-item>

    <el-form-item label="Check In">
      <el-date-picker v-model="form.checkIn" type="datetime" placeholder="Check in" value-format="YYYY-MM-DDTHH:mm:ssZ" />
    </el-form-item>
    <el-form-item label="Check Out">
      <el-date-picker v-model="form.checkOut" type="datetime" placeholder="Check out" value-format="YYYY-MM-DDTHH:mm:ssZ" />
    </el-form-item>

    <el-form-item label="Channel">
      <el-select v-model="form.channel" style="width:200px">
        <el-option label="DIRECT" value="DIRECT" />
        <el-option label="AIRBNB" value="AIRBNB" />
        <el-option label="BOOKING_COM" value="BOOKING_COM" />
        <el-option label="EXPEDIA" value="EXPEDIA" />
        <el-option label="LEASING_CONTRACT" value="LEASING_CONTRACT" />
        <el-option label="OTHER" value="OTHER" />
      </el-select>
    </el-form-item>

    <el-form-item label="Payout (USD)">
      <el-input v-model.number="form.payoutCents" placeholder="e.g. 250000 (in cents)" />
    </el-form-item>

    <el-form-item>
      <el-button type="primary" :loading="loading" @click="submit">Create</el-button>
      <el-button @click="$router.back()">Cancel</el-button>
    </el-form-item>
  </el-form>
</template>
