<template>
  <div class="p-4">
    <Card>
      <template #title>
        Ledger Members
        <span v-if="currentLedgerName" class="text-gray-500 text-sm ml-2">
          ({{ currentLedgerName }} / {{ ledgerId }})
        </span>
      </template>

      <template #content>
        <!-- Add Member -->
        <div class="mb-4 flex items-center gap-2">
          <Select
            v-model="selectedUserId"
            :options="userOptions"
            optionLabel="label"
            optionValue="value"
            filter
            filterPlaceholder="Search users..."
            placeholder="Select a user"
            class="w-96"
            :loading="loadingUsers"
          />
          <Select v-model="newRole" :options="roles" placeholder="Role" class="w-40" />
          <Button
            label="Add"
            icon="pi pi-plus"
            @click="addMember"
            :disabled="!ledgerId || !selectedUserId || loading"
          />
        </div>

        <div v-if="error" class="text-red-500 text-sm mb-2">{{ error }}</div>

        <!-- 空状态 -->
        <div v-if="!loading && members.length === 0" class="text-gray-500 text-sm mb-3">
          暂无成员。请选择上方用户并点击 “Add” 添加首位成员。
        </div>

        <DataTable :value="members" class="w-full" dataKey="userId" :loading="loading" :rows="10" :paginator="true">
          <!-- 直接用 field 验证：如果这一列能显示，说明数据绑定没问题 -->
          <Column field="userId" header="User ID" />

          <!-- 用作用域插槽渲染，避免 :body 的签名差异 -->
          <Column header="Email">
            <template #body="slotProps">
              {{ slotProps.data.user?.email ?? '(no email)' }}
            </template>
          </Column>

          <Column header="Name">
            <template #body="slotProps">
              {{ slotProps.data.user?.name ?? '(no name)' }}
            </template>
          </Column>

          <Column header="Role">
            <template #body="slotProps">
              <Select
                :modelValue="slotProps.data.role"
                :options="roles"
                style="width: 140px"
                @update:modelValue="val => updateRole(slotProps.data.userId, val)"
              />
            </template>
          </Column>

          <Column header="Actions">
            <template #body="slotProps">
              <Button label="Remove" severity="danger" text @click="removeMember(slotProps.data.userId)" />
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, h } from 'vue'
import { useRoute } from 'vue-router'
import { api } from '../../api'
import Button from 'primevue/button'
import Select from 'primevue/select'
import Card from 'primevue/card'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'

const route = useRoute()

// 路由参数
const ledgerId = ref<string | null>(null)

// ledger 基本信息（显示名字）
const currentLedgerName = ref('')

// 列表 & 状态
const members = ref<any[]>([])
const loading = ref(false)
const error = ref('')

// 下拉用户数据
const userOptions = ref<{ label: string; value: string }[]>([])
const selectedUserId = ref<string | null>(null)
const loadingUsers = ref(false)

// 角色
const roles = ['ADMIN', 'MANAGER', 'STAFF', 'VIEWER']
const newRole = ref<'ADMIN' | 'MANAGER' | 'STAFF' | 'VIEWER'>('VIEWER')

// ---------------- API helpers ----------------
function parseErr(e: any) {
  try {
    const msg = typeof e?.message === 'string' ? e.message : String(e)
    const j = JSON.parse(msg)
    return j.message || msg
  } catch {
    return e?.message || 'Request failed'
  }
}

// 载入 ledger 基本信息（显示名字）
async function loadLedgerMeta() {
  if (!ledgerId.value) return
  try {
    const res = await api.get(`/ledger/${ledgerId.value}`) // 返回 { id, name, ... }
    currentLedgerName.value = res?.name || ''
  } catch (e: any) {
    // 不阻断主流程
    console.warn('loadLedgerMeta failed:', parseErr(e))
    currentLedgerName.value = ''
  }
}

// 载入全部用户供下拉
async function loadAllUsers() {
  loadingUsers.value = true
  try {
    const res = await api.get('/ledgerUsers/all-users')
    const list = Array.isArray(res) ? res : res?.data || []
    userOptions.value = list.map((u: any) => ({
      value: u.id,
      label: u.email + (u.name ? ` (${u.name})` : ''),
    }))
  } catch (e: any) {
    error.value = parseErr(e)
  } finally {
    loadingUsers.value = false
  }
}

// 载入当前账簿成员
async function loadMembers() {
  if (!ledgerId.value) return
  loading.value = true
  error.value = ''
  try {
    const res = await api.get(`/ledgerUsers/${ledgerId.value}/users`)
    console.log('loadMembers raw response:', res)

    const normalized = Array.isArray(res) ? res : res?.data || res?.rows || []
    console.log('loadMembers normalized members:', normalized)

    members.value = normalized
  } catch (e: any) {
    console.error('loadMembers error:', e)
    error.value = parseErr(e)
  } finally {
    loading.value = false
    console.log('loadMembers done. ledgerId=', ledgerId.value, 'members=', members.value)
  }
}


// 添加成员
async function addMember() {
  if (!ledgerId.value) return
  if (!selectedUserId.value) return alert('Please select a user')
  loading.value = true
  error.value = ''
  try {
    await api.post(`/ledgerUsers/${ledgerId.value}/users`, {
      userId: selectedUserId.value,
      role: newRole.value,
    })
    selectedUserId.value = null
    await loadMembers()
  } catch (e: any) {
    error.value = parseErr(e)
  } finally {
    loading.value = false
  }
}

// 更新角色
async function updateRole(userId: string, role: string) {
  if (!ledgerId.value) return
  loading.value = true
  error.value = ''
  try {
    await api.put(`/ledgerUsers/${ledgerId.value}/users/${userId}`, { role })
    await loadMembers()
  } catch (e: any) {
    error.value = parseErr(e)
  } finally {
    loading.value = false
  }
}

// 移除成员
async function removeMember(userId: string) {
  if (!ledgerId.value) return
  if (!confirm('Remove this member?')) return
  loading.value = true
  error.value = ''
  try {
    await api.delete(`/ledgerUsers/${ledgerId.value}/users/${userId}`)
    await loadMembers()
  } catch (e: any) {
    error.value = parseErr(e)
  } finally {
    loading.value = false
  }
}

// ---------------- 列模板 ----------------
function emailTemplate(slotProps: any) {
  return slotProps.data.user?.email ?? '(no email)'
}
function nameTemplate(slotProps: any) {
  return slotProps.data.user?.name ?? '(no name)'
}
function roleTemplate(slotProps: any) {
  return h(Select, {
    modelValue: slotProps.data.role,
    options: roles,
    style: 'width: 140px',
    'onUpdate:modelValue': (val: string) =>
      updateRole(slotProps.data.userId, val),
  })
}
function actionTemplate(slotProps: any) {
  return h(Button, {
    label: 'Remove',
    severity: 'danger',
    text: true,
    onClick: () => removeMember(slotProps.data.userId),
  })
}

// ---------------- 路由监听 ----------------
watch(
  () => route.params.ledgerId,
  async (val) => {
    if (typeof val === 'string' && val) {
      ledgerId.value = val
      // 并行加载三个数据
      await Promise.allSettled([loadLedgerMeta(), loadMembers(), loadAllUsers()])
    }
  },
  { immediate: true }
)
</script>
