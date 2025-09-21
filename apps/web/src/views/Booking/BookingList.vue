<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import { useRouter } from "vue-router";
import { api } from "../../api";
import type { Paged, Booking, Property } from "../../types";
import { DateTime } from "luxon";
import { ElMessage, ElMessageBox } from "element-plus";

const router = useRouter();
const loading = ref(false);

// 查询参数
const q = ref({
  page: 1,
  pageSize: 20,
  search: "",
});

const data = ref<Paged<Booking>>({ page: 1, pageSize: 20, total: 0, rows: [] });

async function load() {
  loading.value = true;
  try {
    const params: any = { page: q.value.page, pageSize: q.value.pageSize };
    if (q.value.search) params.search = q.value.search;
    const res = await api.get("/booking?" + new URLSearchParams(params).toString());
    data.value = res;
  } finally {
    loading.value = false;
  }
}


async function downloadExcel() {
  try {
    const blob = await api.getBlob("/export-bookings");
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "bookings.xlsx");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err) {
    console.error("Download failed:", err);
  }
}

function fmtDate(dt?: string) {
  if (!dt) return "";
  return DateTime.fromISO(dt).toFormat("yyyy-LL-dd");
}

onMounted(load);
watch(q, () => load(), { deep: true });

function handleNew() {
  router.push("/booking/new");
}


async function handleDelete(id: string) {
  try {
    await ElMessageBox.confirm(
      "确定要删除这个 Booking 吗？此操作不可恢复！",
      "提示",
      {
        type: "warning",
        confirmButtonText: "删除",
        cancelButtonText: "取消",
      }
    );
    // 用户确认删除
    await api.delete(`/booking/${id}`);
    ElMessage.success("删除成功");
    await load();
  } catch (err: any) {
    if (err === "cancel") {
      // 用户点了取消，不提示
      return;
    }
    console.error("删除失败:", err);
    if (err?.message?.includes("Cannot delete booking with booking records")) {
      ElMessage.error("该 Booking 下还有 BookingRecord，不能删除");
    } else {
      ElMessage.error("删除失败: " + (err.message || "未知错误"));
    }
  }
}



function handleDetail(id: string) {
  router.push(`/booking/${id}`);
}
</script>

<template>
  <div class="flex items-center gap-3 mb-3">
    <el-input
      v-model="q.search"
      placeholder="Search by guest, property, room, channel..."
      clearable
      style="width: 320px"
    />
    <el-button type="primary" @click="handleNew">New Booking</el-button>
    <el-button type="primary" @click="downloadExcel">Download Excel</el-button>

  </div>

  <el-table :data="data.rows" v-loading="loading" border>
    <el-table-column label="Actions" width="120">
      <template #default="{ row }">
        <!-- <el-button size="small" @click="handleDetail(row.id)">View</el-button> -->
        <!-- <el-button size="small" type="primary" @click="handleEdit(row.id)">Edit</el-button> -->
        <el-button size="small" type="primary" @click="handleDelete(row.id)">Delete</el-button>
      </template>
    </el-table-column>
    <el-table-column label="Booking Record" prop="externalRef" width="180">
      <template #default="{ row }">
        <router-link
          :to="`/booking/${row.id}`"
          class="text-blue-500 hover:underline"
        >
          {{ row.externalRef || "-" }}
        </router-link>
      </template>
    </el-table-column>
    <el-table-column label="Status" prop="status" sortable width="130" />
    <el-table-column
      label="Confirm Date"
      prop="createdAt"
      :formatter="(row) => fmtDate(row?.createdAt)"
      sortable
      width="160"
    />
    <el-table-column label="Property" prop="room.property.name" sortable width="240" />
    <el-table-column label="Room" prop="room.label" sortable width="120" />
    <el-table-column label="Guest" prop="guest.name" sortable width="160">
      <template #default="{ row }">
        <router-link
          :to="`/guest/${row.guestId}`"
          class="text-blue-500 hover:underline"
        >
          {{ row.guest?.name || "-" }}
        </router-link>
      </template>
    </el-table-column>

    <el-table-column label="Check In" prop="checkIn" sortable width="140" />
    <el-table-column label="Check Out" prop="checkOut" sortable width="140" />
    <el-table-column label="Channel" prop="channel.label" sortable width="150" />

    <el-table-column
      label="Payout"
      :formatter="(row) =>
        row?.payoutCents != null ? '$' + (row.payoutCents / 100).toFixed(2) : ''
      "
      width="120"
    />
    <el-table-column
      label="Guest Total"
      :formatter="(row) =>
        row?.guestTotalCents != null ? '$' + (row.guestTotalCents / 100).toFixed(2) : ''
      "
      width="120"
    />
  </el-table>

  <div class="mt-3 flex justify-end">
    <el-pagination
      layout="prev, pager, next, sizes, total"
      :page-sizes="[10, 20, 50, 100,1000]"
      v-model:current-page="q.page"
      v-model:page-size="q.pageSize"
      :total="data.total"
    />
  </div>
</template>

<style scoped>
.flex {
  display: flex;
}
.items-center {
  align-items: center;
}
.gap-3 {
  gap: 12px;
}
.mb-3 {
  margin-bottom: 12px;
}
.mt-3 {
  margin-top: 12px;
}
.justify-end {
  justify-content: flex-end;
}
</style>
