<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { api } from './api'
import { useAuth } from './stores/auth'   // ✅ 引入 Pinia store

const auth = useAuth()
const router = useRouter()

const searchQuery = ref('')
const isCollapse = ref(true)
const currentLedgerId = ref<string | null>(null)

// ── 拉取 ledger 列表，确定当前 ledgerId ─────────────────────────
onMounted(async () => {
  try {
    const res = await api.get('/ledger') // 你的 /api/ledger 列表接口
    if (res.rows && res.rows.length > 0) {
      const uscLedger = res.rows.find((l: any) => l.name === 'USC-TPM')
      currentLedgerId.value = uscLedger ? uscLedger.id : res.rows[0].id
    }
  } catch (err) {
    console.error('加载 ledger 出错', err)
  }
})

// ── 初始化登录态（Pinia 从 localStorage 读取一次） ───────────────
onMounted(() => {
  auth.loadFromLocalStorage()
  if (!auth.token) {
    router.push('/login')
  }
})

// ── 顶部行为 ───────────────────────────────────────────────────
function logout() {
  auth.logout()
  router.push('/login')
}
function handleSearch() {
  const q = searchQuery.value.trim()
  if (!q) return
  router.push({ path: '/search', query: { q } })
}
function goBack() { router.back() }
function goForward() { router.forward() }
function toggleMenu() { isCollapse.value = !isCollapse.value }
</script>

<template>
  <el-container style="min-height: 100vh">
    <!-- 左侧菜单 -->
    <el-aside :width="isCollapse ? '64px' : '200px'"
              style="background-color: #f5f5f5; border-right: 1px solid #ddd;">
      <el-menu default-active="/" class="el-menu-vertical" router :collapse="isCollapse">

        <!-- 展开/收起按钮 -->
        <div style="display: flex; justify-content: center;">
          <el-button text circle size="large" @click="toggleMenu">
            <el-icon>
              <Icon icon="mdi:expand-all" v-if="isCollapse" />
              <Icon icon="mdi:collapse-all" v-else />
            </el-icon>
          </el-button>
        </div>

        <el-menu-item index="/booking">
          <el-icon><Icon icon="mdi:calendar-check-outline" /></el-icon>
          <span>Booking</span>
        </el-menu-item>

        <el-menu-item index="/property">
          <el-icon><Icon icon="mdi:house-city-outline" /></el-icon>
          <span>Property</span>
        </el-menu-item>

        <el-menu-item index="/guest">
          <el-icon><Icon icon="mdi:people-outline" /></el-icon>
          <span>Guest</span>
        </el-menu-item>

        <el-menu-item index="/report">
          <el-icon><Icon icon="mdi:note" /></el-icon>
          <span>Report</span>
        </el-menu-item>

        <el-menu-item index="/property-report">
          <el-icon><Icon icon="mdi:report-box-multiple-outline" /></el-icon>
          <span>Property Report</span>
        </el-menu-item>

        <el-menu-item index="/ExampleRoomMap">
          <el-icon><Icon icon="mdi:house-outline" /></el-icon>
          <span>Demo Property Map</span>
        </el-menu-item>

        <el-menu-item index="/users">
          <el-icon><Icon icon="mdi:account-multiple-outline" /></el-icon>
          <span>User Management</span>
        </el-menu-item>

        <!-- ⚠️ 这里修正为 /ledgers（和你的路由一致） -->
        <el-menu-item :index="currentLedgerId ? `/ledger/${currentLedgerId}/users` : '/settings'">
          <el-icon><Icon icon="mdi:account-group-outline" /></el-icon>
          <span>Ledger Members</span>
        </el-menu-item>

      </el-menu>
    </el-aside>

    <!-- 右侧内容 -->
    <el-container>
      <!-- 顶部导航栏 -->
      <el-header height="60px" class="header-bar">
        <el-button type="primary" link @click="goBack" class="mr-4">← Back</el-button>

        <el-input v-model="searchQuery" placeholder="Search Booking / Property / Room / Guest" clearable
                  @keyup.enter.native="handleSearch" style="max-width: 400px">
          <template #append>
            <el-button icon="el-icon-search" @click="handleSearch" />
          </template>
        </el-input>

        <el-button type="primary" link @click="goForward" class="mr-4">→ forward</el-button>

        <!-- 右侧：用户信息 / 设置 -->
        <div style="margin-left:auto; display: flex; align-items: center; gap: 8px;">
          <span v-if="auth.user" style="color:#333; font-weight:500;">
            👤 {{ auth.user.name || auth.user.email }}
          </span>
          <el-button v-if="auth.user" text @click="logout">Logout</el-button>
          <el-button v-else text @click="router.push('/login')">Login</el-button>
          <el-button text @click="router.push('/settings')">
            <Icon icon="mdi:settings" width="22" height="22" />
          </el-button>
        </div>
      </el-header>

      <!-- 主内容区 -->
      <el-main class="main-content">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<style scoped>
.header-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
  background: white;
  border-bottom: 1px solid #eee;
}
.main-content {
  padding: 16px;
  background: #fafafa;
}
</style>
