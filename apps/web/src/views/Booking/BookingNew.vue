<script setup lang="ts">
import { ref, reactive, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { api } from '../../api';
import dayjs from 'dayjs';
import GuestForm from '../Guest/GuestNew.vue';
// import { prisma } from "../../prisma.js";

const router = useRouter();

const form = reactive({
  propertyId: '',
  roomId: '',
  guestId: '',
  checkIn: `${dayjs().format("YYYY-MM-DD")}`,
  checkOut: `${dayjs().add(1, "day").format("YYYY-MM-DD")}`,
  channelId: '',   // 👈 改成 channelId
  memo: '',
  payout: null as number | null,       // USD
  guestTotal: null as number | null,   // USD
  confirmationCode: '',
  contractUrl: ''
});

const properties = ref<any[]>([]);
const rooms = ref<any[]>([]);
const guests = ref<any[]>([]);
const guestBookings = ref<any[]>([]);
const loading = ref(false);
const showGuestDialog = ref(false);

async function loadProperties() {
  properties.value = await api.get('/property/list');
}
async function loadRooms() {
  rooms.value = [];
  if (form.propertyId) {
    const res = await api.get(`/room?propertyId=${form.propertyId}`);
    rooms.value = res.rows ?? [];
  }
}
async function loadGuests() {
  const res = await api.get('/guest?pageSize=500');
  guests.value = res.rows ?? [];
}

// async function loadGuestBookings() {
//   guestBookings.value = [];
//   if (!form.guestId) return;
//   const query = new URLSearchParams({ guestId: form.guestId, pageSize: '20' }).toString();
//   const res = await api.get(`/booking?${query}`);
//   guestBookings.value = res.rows ?? [];
// }

async function loadGuestBookings() {
  guestBookings.value = [];
  if (!form.guestId) return;
  const query = new URLSearchParams({ guestId: form.guestId, pageSize: '50' }).toString();
  const res = await api.get(`/booking?${query}`);
  guestBookings.value = res.rows ?? [];

  if (guestBookings.value.length > 0) {
    // 找到 checkout 最晚的 booking
    const latestBooking = guestBookings.value.reduce((latest, b) => {
      return dayjs(b.checkOut).isAfter(dayjs(latest.checkOut)) ? b : latest;
    });

    // 自动填充表单
    form.propertyId = latestBooking.room?.property?.id || '';
    form.roomId = latestBooking.roomId || '';
    form.channelId = latestBooking.channel?.id || '';
    form.confirmationCode = latestBooking.externalRef || '';
    form.checkIn = latestBooking.checkIn;
    form.checkOut = latestBooking.checkOut;
    form.payout = latestBooking.payoutCents ? latestBooking.payoutCents / 100 : null;
    form.guestTotal = latestBooking.guestTotalCents ? latestBooking.guestTotalCents / 100 : null;


    // 如果用户换 property，要重新加载 rooms 保证 roomId 选项正确
    if (form.propertyId) {
      await loadRooms();
    }
  } else {
    // 没有记录 → 清空表单
    form.propertyId = '';
    form.roomId = '';
    form.channelId = '';
    form.confirmationCode = '';
    form.checkIn = `${dayjs().format("YYYY-MM-DD")}`;
    form.checkOut = `${dayjs().add(1, "day").format("YYYY-MM-DD")}`;
    form.payout = null;
    form.guestTotal = null;
  }
}

const channels = ref<any[]>([]);

async function loadChannels() {
  const res = await api.get('/channel'); // 👈 需要后端提供 channel 列表 API
  channels.value = res.rows ?? res;      // [{ id, label }]
}
watch(() => form.guestId, () => {
  loadGuestBookings();
});

onMounted(() => {
  loadProperties();
  loadGuests();
  loadChannels(); // 👈 加载渠道列表
});


async function submit() {
  loading.value = true;
  try {
    // 1. 本地查找是否已有相同 externalRef + channelId + roomId
    const existing = guestBookings.value.find(b =>
      b.externalRef === form.confirmationCode &&
      b.channel?.id === form.channelId &&   // 👈 对比 channelId
      b.roomId === form.roomId
    );


    // 转换金额为 cents
    const newPayoutCents = form.payout != null ? Math.round(form.payout * 100) : null;
    const newGuestTotalCents = form.guestTotal != null ? Math.round(form.guestTotal * 100) : null;

    // const payload = {
    //   ...form,
    //   payoutCents: form.payout != null ? Math.round(form.payout * 100) : null,
    //   guestTotalCents: form.guestTotal != null ? Math.round(form.guestTotal * 100) : null,
    // };
    // delete payload.payout;
    // delete payload.guestTotal;

    // await api.post('/booking', payload);
    // ElMessage.success('Booking created!');


    if (existing) {
      // ===== 已存在 → 更新逻辑 =====
      console.log('Found existing booking:', existing);
      const oldCheckIn = dayjs(existing.checkIn);
      const oldCheckOut = dayjs(existing.checkOut);
      const newCheckIn = dayjs(form.checkIn);
      const newCheckOut = dayjs(form.checkOut);

      let recordType: "EXTEND" | "SHORTEN" | "UPDATE" = "UPDATE";
      let rangeStart: string | null = null;
      let rangeEnd: string | null = null;


      if (newCheckOut.isAfter(oldCheckOut)) {
        recordType = "EXTEND";
        rangeStart = oldCheckOut.toISOString();
        rangeEnd = newCheckOut.toISOString();
      } else if (newCheckIn.isBefore(oldCheckIn)) {
        recordType = "EXTEND";
        rangeStart = newCheckIn.toISOString();
        rangeEnd = oldCheckIn.toISOString();
      } else if (newCheckOut.isBefore(oldCheckOut)) {
        recordType = "SHORTEN";
        rangeStart = newCheckOut.toISOString();
        rangeEnd = oldCheckOut.toISOString();
      } else if (newCheckIn.isAfter(oldCheckIn)) {
        recordType = "SHORTEN";
        rangeStart = oldCheckIn.toISOString();
        rangeEnd = newCheckIn.toISOString();
      }

      const guestDeltaCents =
        newGuestTotalCents != null && existing.guestTotalCents != null
          ? newGuestTotalCents - existing.guestTotalCents
          : null;
      const payoutDeltaCents =
        newPayoutCents != null && existing.payoutCents != null
          ? newPayoutCents - existing.payoutCents
          : null;

                // 更新 booking 主表
      // await api.patch(`/booking/${existing.id}`, {
      //   checkIn: newCheckIn.toISOString(),
      //   checkOut: newCheckOut.toISOString(),
      //   guestTotalCents: newGuestTotalCents,
      //   payoutCents: newPayoutCents,
      //   memo: form.memo,
      // });

      // // 创建 bookingRecord
      await api.post('/booking/bookingRecord', {
        bookingId: existing.id,
        type: recordType,
        guestDeltaCents,
        payoutDeltaCents,
        rangeStart,
        rangeEnd,
      });

      // 更新 booking 主表
      console.log("Booking update payload:", {
        bookingId: existing.id,
        checkIn: newCheckIn.toISOString(),
        checkOut: newCheckOut.toISOString(),
        guestTotalCents: newGuestTotalCents,
        payoutCents: newPayoutCents,
        memo: form.memo,
      });

      // 创建 bookingRecord
      console.log("BookingRecord payload:", {
        bookingId: existing.id,
        type: recordType,
        guestDeltaCents,
        payoutDeltaCents,
        rangeStart,
        rangeEnd,
      });

      ElMessage.success(`Booking ${recordType.toLowerCase()} successful!`);

      // ElMessage.success('Booking updated!');
    } else {
      // ===== 不存在 → 新建逻辑 =====
      console.log('No existing booking, create new');

    //  // ===== 不存在 → 新建逻辑 =====
     const newBooking = await api.post('/booking', {
        roomId: form.roomId,
        guestId: form.guestId,
        channelId: form.channelId,
        externalRef: form.confirmationCode,
        checkIn: form.checkIn,
        checkOut: form.checkOut,
        guestTotalCents: newGuestTotalCents,
        payoutCents: newPayoutCents,
        memo: form.memo,
      });

      await api.post('/booking/bookingrecord', {
        bookingId: newBooking.id,
        type: 'NEW',
        guestDeltaCents: newGuestTotalCents,
        payoutDeltaCents: newPayoutCents,
        rangeStart: form.checkIn,
        rangeEnd: form.checkOut,
      });

      ElMessage.success('Booking created!');
    }

    // router.push('/');
  } finally {
    loading.value = false;
  }
}
const useNewGuest = ref(false); // 👈 默认选择已有 Guest

// 👇 这里 guest 直接传回来
async function handleGuestSaved(guest: any) {
  useNewGuest.value = false;     // 保存完切回“选择模式”
  await loadGuests();
  form.guestId = guest.id;       // 自动选择新建的 guest
}

</script>


<template>
  <el-form label-width="120px">
    <el-row :gutter="20">
      <!-- 左边卡片 -->
      <el-col :span="12">
        <el-card shadow="hover">
          <template #header>
            <span>Guest & Room</span>
          </template>

          <!-- Guest -->
          <el-form-item label="Guest">
            <div class="flex items-center gap-4">
              <el-radio-group v-model="useNewGuest" size="small">
                <el-radio :label="false">Select Existing</el-radio>
                <el-radio :label="true">New Guest</el-radio>
              </el-radio-group>
            </div>

            <el-select
              v-if="!useNewGuest"
              v-model="form.guestId"
              placeholder="Select guest"
              filterable
              style="width: 100%; margin-top: 8px"
              @change="loadGuestBookings"
            >
              <el-option
                v-for="g in guests"
                :key="g.id"
                :label="g.name"
                :value="g.id"
              />
            </el-select>

            <div v-else style="margin-top: 8px">
              <GuestForm @saved="handleGuestSaved" />
            </div>
          </el-form-item>

          <!-- Property -->
          <el-form-item label="Property">
            <el-select v-model="form.propertyId" placeholder="Select property" @change="loadRooms" filterable style="width: 100%">
              <el-option v-for="p in properties" :key="p.id" :label="p.name" :value="p.id" />
            </el-select>
          </el-form-item>

          <!-- Room -->
          <el-form-item label="Room">
            <el-select v-model="form.roomId" placeholder="Select room" filterable style="width: 100%">
              <el-option v-for="r in rooms" :key="r.id" :label="r.label" :value="r.id" />
            </el-select>
          </el-form-item>

          <!-- Channel -->
          <el-form-item label="Channel">
            <el-select v-model="form.channelId" placeholder="Select channel" style="width: 100%">
              <el-option
                v-for="c in channels"
                :key="c.id"
                :label="c.label"
                :value="c.id"
              />
            </el-select>
          </el-form-item>
        </el-card>
      </el-col>

      <!-- 右边卡片 -->
      <el-col :span="12">
        <el-card shadow="hover">
          <template #header>
            <span>Booking Info</span>
          </template>

          <el-form-item label="Confirmation Code">
            <el-input v-model="form.confirmationCode" placeholder="e.g. AIRBNB-XYZ123" />
          </el-form-item>

          <el-form-item label="Check In">
            <el-date-picker v-model="form.checkIn" type="date" value-format="YYYY-MM-DD" placeholder="Check in" style="width: 100%" />
          </el-form-item>

          <el-form-item label="Check Out">
            <el-date-picker v-model="form.checkOut" type="date" value-format="YYYY-MM-DD" placeholder="Check out" style="width: 100%" />
          </el-form-item>

          <el-form-item label="Payout (USD)">
            <el-input-number v-model="form.payout" :step="0.01" :precision="2" style="width: 100%" />
          </el-form-item>

          <el-form-item label="Guest Total (USD)">
            <el-input-number v-model="form.guestTotal" :step="0.01" :precision="2" style="width: 100%" />
          </el-form-item>
        </el-card>
      </el-col>
    </el-row>

    <!-- 按钮单独卡片 -->
    <el-row>
      <el-col :span="24">
        <el-card shadow="never">
          <el-form-item>
            <el-button type="primary" :loading="loading" @click="submit">Add New Record</el-button>
            <el-button @click="$router.back()">Cancel</el-button>
          </el-form-item>
        </el-card>
      </el-col>
    </el-row>
  </el-form>

  <!-- Guest Bookings -->
  <el-divider content-position="left">Guest Bookings</el-divider>
  <el-card shadow="never">
    <el-table :data="guestBookings" border style="width: 100%">
      <el-table-column label="Update At" :formatter="(row) => dayjs(row.updateAt).format('YYYY-MM-DD')" />
      <el-table-column label="Property" prop="room.property.name" />
      <el-table-column label="Room" prop="room.label" />
      <el-table-column label="Check In" :formatter="(row) => dayjs(row.checkIn).format('YYYY-MM-DD')" />
      <el-table-column label="Check Out" :formatter="(row) => dayjs(row.checkOut).format('YYYY-MM-DD')" />
      <el-table-column label="Confirmation Code" prop="externalRef" />
      <el-table-column label="Channel" prop="channel.label" />
      <el-table-column label="Payout" :formatter="(row) => row.payoutCents ? '$' + (row.payoutCents/100).toFixed(2) : ''" />
      <el-table-column label="Guest Total" :formatter="(row) => row.guestTotalCents ? '$' + (row.guestTotalCents/100).toFixed(2) : ''" />
    </el-table>
  </el-card>
</template>

