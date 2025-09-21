<script setup lang="ts">
import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import { api } from '../../api';
import { useRouter } from 'vue-router'
const router = useRouter()

const props = defineProps<{
  guestId?: string;   // 如果传了 guestId 则为编辑模式
  initialData?: { name: string; email?: string; phone?: string };
}>();

const emit = defineEmits<{
  (e: 'saved', guest: any): void;
  (e: 'cancel'): void;
}>();

const form = ref({
  name: props.initialData?.name || '',
  email: props.initialData?.email || '',
  phone: props.initialData?.phone || ''
});

const loading = ref(false);

async function submit() {
  if (!form.value.name.trim()) {
    ElMessage.error('Name is required');
    return;
  }

  loading.value = true;
  try {
    let result;
    if (props.guestId) {
      result = await api.post(`/guest/${props.guestId}`, form.value, { method: 'PATCH' });
      ElMessage.success('Guest updated');
    } else {
      result = await api.post('/guest', form.value);
      ElMessage.success('Guest created');
    }
    emit('saved', result); // 👈 这里传回 guest 对象
    // router.push('/guest')   // 👈 保存后直接跳转 GuestList
  } catch (err: any) {
    ElMessage.error(err.message || 'Failed to save guest');
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <el-form :model="form" label-width="120px">
    <el-form-item label="Name" required>
      <el-input v-model="form.name" />
    </el-form-item>
    <el-form-item label="Email">
      <el-input v-model="form.email" />
    </el-form-item>
    <el-form-item label="Phone">
      <el-input v-model="form.phone" />
    </el-form-item>
    <el-form-item>
      <el-button type="primary" :loading="loading" @click="submit">Save</el-button>
      <!-- <el-button @click="emit('cancel')">Cancel</el-button> -->
    </el-form-item>
  </el-form>
</template>
