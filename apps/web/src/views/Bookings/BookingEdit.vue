<script setup lang="ts">
import { ref,reactive, onMounted,watch } from 'vue';
import { ElMessage } from 'element-plus';

import { api } from '../../api';
import type { Property, Room, Guest } from '../../types';
import { useRouter,useRoute } from 'vue-router';
import dayjs from 'dayjs'; // 如果没有装 dayjs，可以 `npm i dayjs`

const router = useRouter();
const route = useRoute();

const bookingId = route.params.id as string | undefined;

const form = reactive({
  propertyId: '',
  roomId: '',
  guestId: '',
  checkIn: '',
  checkOut: '',
  channel: 'AIRBNB',
  memo: '',
  payoutCents: null as number | null,
  guestTotalCents: null as number | null,
  confirmationCode: '',
  contractUrl: ''
});

const properties = ref<Property[]>([]);
const rooms = ref<Room[]>([]);
const guests = ref<Guest[]>([]);
const loading = ref(false);

const payoutUsd = ref<number | null>(null);
const guestTotalUsd = ref<number | null>(null);

const payoutInput = ref('');
const guestTotalInput = ref('');

function handlePayoutBlur() {
  const val = parseFloat(payoutInput.value);
  if (!isNaN(val)) {
    form.payoutCents = Math.round(val * 100);
  } else {
    form.payoutCents = null;
  }
}

function handleGuestTotalBlur() {
  const val = parseFloat(guestTotalInput.value);
  if (!isNaN(val)) {
    form.guestTotalCents = Math.round(val * 100);
  } else {
    form.guestTotalCents = null;
  }
}

watch(payoutUsd, (val) => {
  form.payoutCents = val != null ? Math.round(parseFloat(val.toFixed(2)) * 100) : null;
});

watch(guestTotalUsd, (val) => {
  form.guestTotalCents = val != null ? Math.round(parseFloat(val.toFixed(2)) * 100) : null;
});

async function loadProperties() {
  const res = await api.get('/propertieslist');
  properties.value = res?? [];
}
async function loadRooms() {
  rooms.value = [];
  if (!form.propertyId) return;
  const query = new URLSearchParams({
  propertyId: form.propertyId,
    pageSize: "500"
  }).toString();
  const res = await api.get(`/rooms?${query}`);
  rooms.value = res.rows?? [];
}


async function loadGuests() {

  const query = new URLSearchParams({
    pageSize: "500"
  }).toString();
  const res = await api.get(`/guests?${query}`);
  // const res = await api.get('/guests', { params: { pageSize: 500 } });
  guests.value = res.rows?? [];
}


onMounted(async () => {
  await loadProperties();
  await loadGuests();

  const today = dayjs().format("YYYY-MM-DD");

  if (bookingId) {
    const res = await api.get(`/bookings/${bookingId}`);

    // 1. 填入已有数据（但不要先赋值 roomId）
    Object.assign(form, {
      ...res,
      checkIn: res.checkIn,
      checkOut: res.checkOut,
      guestId: res.guestId,
      channel: res.channel,
      memo: res.memo,
      confirmationCode: res.confirmationCode,
      contractUrl: res.contractUrl,
      payoutCents: res.payoutCents,
      guestTotalCents: res.guestTotalCents,
    });

    // 2. 设置 payout/guestTotal input 值
    payoutInput.value = res.payoutCents ? (res.payoutCents / 100).toFixed(2) : '';
    guestTotalInput.value = res.guestTotalCents ? (res.guestTotalCents / 100).toFixed(2) : '';

    // 3. 设置 propertyId 并加载对应 rooms，再设置 roomId
    form.propertyId = res.room.propertyId; // 👈 从 res.room.propertyId 拿
    await loadRooms(); // 👈 保证 rooms 已加载
    form.roomId = res.roomId; // 👈 现在再设置 roomId
  } else {
    // 新建默认值
    form.checkIn = `${today}T15:00:00Z`;
    form.checkOut = `${today}T11:00:00Z`;
  }
});

async function submit() {
  loading.value = true;
  try {
    const payload = {
      roomId: form.roomId,
      guestId: form.guestId,
      checkIn: form.checkIn,
      checkOut: form.checkOut,
      channel: form.channel,
      payoutCents: form.payoutCents ?? null,
      guestTotalCents: form.guestTotalCents ?? null,
      memo: form.memo || null,
      confirmationCode: form.confirmationCode || null,
      contractUrl: form.contractUrl || null
    };

    if (bookingId) {
      await api.post(`/bookings/${bookingId}`, payload); // 或 PUT
      ElMessage.success('Updated');
    } else {
      await api.post('/bookings', payload);
      ElMessage.success('Created');
    }

    router.push('/');
  } finally {
    loading.value = false;
  }
}

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
      <el-date-picker v-model="form.checkIn" type="datetime" placeholder="Check in" value-format="YYYY-MM-DDTHH:mm:ssZ"  />
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

    <el-form-item label="Confirmation Code">
      <el-input v-model="form.confirmationCode" placeholder="e.g. AIRBNB-XYZ123" />
    </el-form-item>

    <!-- <el-form-item label="Payout (USD)">
      <el-input v-model.number="payoutUsd" placeholder="e.g. $2500.00" :step="0.01" />
    </el-form-item>

    <el-form-item label="Guest Total (USD)">
      <el-input v-model.number="guestTotalUsd" placeholder="e.g. $2700.00" :step="0.01" />
    </el-form-item> -->

    <el-form-item label="Payout (USD)">
      <el-input
        v-model="payoutInput"
        placeholder="e.g. 2500.75"
        @blur="handlePayoutBlur"
      />
    </el-form-item>

    <el-form-item label="Guest Total (USD)">
      <el-input
        v-model="guestTotalInput"
        placeholder="e.g. 3000.99"
        @blur="handleGuestTotalBlur"
      />
    </el-form-item>

    <el-form-item>
      <el-button type="primary" :loading="loading" @click="submit">Create</el-button>
      <el-button @click="$router.back()">Cancel</el-button>
    </el-form-item>
  </el-form>
</template>
