<!-- ==========================
Users.vue (Admin only)
- 列表 + 搜索 + 分页
- 创建新用户（弹窗）
- 行内修改角色
- 删除用户（保护自己账号）
========================== -->
<template>
    <div class="p-4 space-y-4">
      <Card>
        <template #title>
          <div class="flex items-center justify-between">
            <span>Users</span>
            <div class="flex items-center gap-2">
              <InputText v-model="q" placeholder="Search email / name / phone" class="w-64" @keydown.enter="loadUsers" />
              <Button label="Search" icon="pi pi-search" :disabled="loading" @click="loadUsers" />
              <Button label="New User" icon="pi pi-user-plus" severity="success" @click="openCreate()" />
            </div>
          </div>
        </template>
  
        <template #content>
          <div v-if="error" class="text-red-600 text-sm mb-2">{{ error }}</div>
  
          <DataTable
            :value="pagedUsers"
            class="w-full"
            :loading="loading"
            dataKey="id"
            :rows="pageSize"
            :totalRecords="filteredUsers.length"
            :paginator="true"
            :first="first"
            @page="onPage"
          >
            <Column field="email" header="Email" />
            <Column header="Role" :body="roleBody" />
            <Column field="name" header="Name" />
            <Column field="phone" header="Phone" />
            <Column header="Created" :body="createdBody" />
            <Column header="Actions" :body="actionBody" />
          </DataTable>
        </template>
      </Card>
  
      <!-- 创建用户弹窗 -->
      <Dialog v-model:visible="showCreate" header="Create New User" :modal="true" class="w-[520px] max-w-[92vw]">
        <div class="space-y-3">
          <div class="grid grid-cols-3 items-center gap-2">
            <label class="text-sm text-gray-600">Email</label>
            <InputText v-model="form.email" class="col-span-2" placeholder="required" />
          </div>
          <div class="grid grid-cols-3 items-center gap-2">
            <label class="text-sm text-gray-600">Password</label>
            <Password v-model="form.password" class="col-span-2" :feedback="false" toggleMask placeholder="required" />
          </div>
          <div class="grid grid-cols-3 items-center gap-2">
            <label class="text-sm text-gray-600">Name</label>
            <InputText v-model="form.name" class="col-span-2" placeholder="optional" />
          </div>
          <div class="grid grid-cols-3 items-center gap-2">
            <label class="text-sm text-gray-600">Phone</label>
            <InputText v-model="form.phone" class="col-span-2" placeholder="optional" />
          </div>
          <div class="grid grid-cols-3 items-center gap-2">
            <label class="text-sm text-gray-600">Role</label>
            <Select v-model="form.role" :options="roles" class="col-span-2" />
          </div>
  
          <div v-if="formError" class="text-red-600 text-sm">{{ formError }}</div>
        </div>
  
        <template #footer>
          <Button label="Cancel" text :disabled="submitting" @click="showCreate = false" />
          <Button label="Create" icon="pi pi-check" :loading="submitting" @click="createUser" />
        </template>
      </Dialog>
    </div>
  </template>
  
  <script setup lang="ts">
  import { ref, computed, onMounted, h } from 'vue'
  import { api } from '../../api'
  
  import Button from 'primevue/button'
  import InputText from 'primevue/inputtext'
  import Password from 'primevue/password'
  import Select from 'primevue/select'
  import Card from 'primevue/card'
  import DataTable from 'primevue/datatable'
  import Column from 'primevue/column'
  import Dialog from 'primevue/dialog'
  
  // ====== 状态 ======
  const users = ref<any[]>([])
  const loading = ref(false)
  const error = ref('')
  
  const q = ref('')                // 搜索关键词（前端过滤）
  const pageSize = ref(10)
  const first = ref(0)             // DataTable 分页 offset
  
  const roles = ['ADMIN', 'MANAGER', 'STAFF', 'VIEWER']
  
  // 创建用户弹窗
  const showCreate = ref(false)
  const submitting = ref(false)
  const formError = ref('')
  const form = ref<{ email: string; password: string; name?: string; phone?: string; role: string }>({
    email: '',
    password: '',
    name: '',
    phone: '',
    role: 'STAFF',
  })
  
  // 当前登录用户（用于自我删除保护），按你的实际存储方式取
  const selfId = localStorage.getItem('uid') || ''
  
  // ====== 工具函数 ======
  function parseErr(e: any) {
    const msg = e?.response?.data?.message || e?.response?.data?.error
    if (msg) return String(msg)
    return e?.message || 'Request failed'
  }
  
  function fmtDate(v: string) {
    try {
      return new Date(v).toLocaleString()
    } catch {
      return v
    }
  }
  
  // ====== 数据加载 ======
  async function loadUsers() {
    loading.value = true
    error.value = ''
    try {
      // 若你的 api 是 axios 实例，且需要 res.data，请改为：
      // const res = await api.get('/users')
      // users.value = res.data
      const res = await api.get('/users')
      users.value = Array.isArray(res) ? res : res?.data || []
      // 重置到第一页
      first.value = 0
    } catch (e: any) {
      error.value = parseErr(e)
    } finally {
      loading.value = false
    }
  }
  
  // ====== 过滤 + 分页（前端） ======
  const filteredUsers = computed(() => {
    const keyword = q.value.trim().toLowerCase()
    if (!keyword) return users.value
    return users.value.filter((u: any) => {
      return (
        String(u.email || '').toLowerCase().includes(keyword) ||
        String(u.name || '').toLowerCase().includes(keyword) ||
        String(u.phone || '').toLowerCase().includes(keyword) ||
        String(u.role || '').toLowerCase().includes(keyword)
      )
    })
  })
  
  const pagedUsers = computed(() => {
    const start = first.value
    const end = start + pageSize.value
    return filteredUsers.value.slice(start, end)
  })
  
  function onPage(e: any) {
    first.value = e.first
    // e.rows 是当前页大小，可按需同步 pageSize
    pageSize.value = e.rows
  }
  
  // ====== 列模板 ======
  function roleBody(slotProps: any) {
    return h(Select, {
      modelValue: slotProps.data.role,
      options: roles,
      style: 'width: 140px',
      'onUpdate:modelValue': async (val: string) => {
        await updateRole(slotProps.data.id, val)
      },
      disabled: slotProps.data.id === selfId, // 不允许自己改自己的角色（可选）
    })
  }
  
  function createdBody(slotProps: any) {
    return fmtDate(slotProps.data.createdAt)
  }
  
  function actionBody(slotProps: any) {
    const row = slotProps.data
    const disabled = row.id === selfId // 自我删除保护
    return h(Button, {
      label: disabled ? 'Self' : 'Delete',
      severity: 'danger',
      text: true,
      disabled,
      onClick: () => remove(row.id),
    })
  }
  
  // ====== 操作 ======
  async function updateRole(id: string, role: string) {
    try {
      // 仅修改角色
      // 如果你的后端 PUT /users/:id 需要完整 data，可改为 { role } 之外保留原值
      await api.put(`/users/${id}`, { role })
      // 本地同步也可直接改 users 列表，避免全量刷新
      const u = users.value.find((x) => x.id === id)
      if (u) u.role = role
    } catch (e: any) {
      error.value = parseErr(e)
      // 回滚 UI
      await loadUsers()
    }
  }
  
  async function remove(id: string) {
    if (id === selfId) {
      error.value = 'You cannot delete yourself.'
      return
    }
    if (!confirm('Delete this user?')) return
    try {
      await api.delete(`/users/${id}`)
      users.value = users.value.filter((x) => x.id !== id)
    } catch (e: any) {
      error.value = parseErr(e)
    }
  }
  
  // ====== 创建用户 ======
  function openCreate() {
    form.value = { email: '', password: '', name: '', phone: '', role: 'STAFF' }
    formError.value = ''
    showCreate.value = true
  }
  
  async function createUser() {
    submitting.value = true
    formError.value = ''
    try {
      const payload = {
        email: form.value.email?.trim(),
        password: form.value.password,
        name: form.value.name?.trim() || undefined,
        phone: form.value.phone?.trim() || undefined,
        role: form.value.role,
      }
      if (!payload.email || !payload.password) {
        formError.value = 'Email and password are required.'
        submitting.value = false
        return
      }
      // 需要后端实现 POST /users （仅 ADMIN）
      // 若你的 api 返回 Axios 响应，请取 res.data
      await api.post('/users', payload)
      showCreate.value = false
      await loadUsers()
    } catch (e: any) {
      formError.value = parseErr(e)
    } finally {
      submitting.value = false
    }
  }
  
  onMounted(loadUsers)
  </script>
  
  <style scoped>
  /* 可按需微调 */
  </style>
  