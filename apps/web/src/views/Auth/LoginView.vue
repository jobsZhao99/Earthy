<template>
  <div class="flex items-center justify-center h-screen bg-gray-100">
    <div class="bg-white p-6 rounded shadow-md w-96">
      <h2 class="text-xl font-bold mb-4 text-center">Login</h2>
      <el-form @submit.prevent="login">
        <el-form-item>
          <el-input v-model="email" placeholder="Email" />
        </el-form-item>
        <el-form-item>
          <el-input v-model="password" type="password" placeholder="Password" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" class="w-full" @click="login">Login</el-button>
        </el-form-item>
      </el-form>
      <p v-if="error" class="text-red-500 text-sm mt-2">{{ error }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../../api'
import { useAuth } from '../../stores/auth'   // ✅ 引入 auth store

const router = useRouter()
const email = ref('')
const password = ref('')
const error = ref('')
const auth = useAuth()  // ✅ 拿到 pinia store

async function login() {
  // console.log('Logging in with', email.value, password.value)
  try {
    const res = await api.post('/auth/login', {
      email: email.value,
      password: password.value
    })

    // console.log('Login response:', res)

    // ✅ 更新 store，同时也写 localStorage（防止刷新丢失）
    auth.setAuth(res.user, res.accessToken)

    router.push('/booking') // 登录成功跳转
  } catch (err: any) {
    error.value = err.message || 'Login failed'
    console.error('Login error:', err)
  }
}
</script>
