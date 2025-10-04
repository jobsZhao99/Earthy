// src/stores/auth.ts
import { defineStore } from 'pinia'

export const useAuth = defineStore('auth', {
  state: () => ({
    user: null as any,
    token: null as string | null,
  }),
  actions: {
    setAuth(user: any, token: string) {
      this.user = user
      this.token = token
      localStorage.setItem('user', JSON.stringify(user))
      localStorage.setItem('token', token)
    },
    logout() {
      this.user = null
      this.token = null
      localStorage.removeItem('user')
      localStorage.removeItem('token')
    },
    // ✅ 方法名改成和 App.vue 一样
    loadFromLocalStorage() {
      const storedUser = localStorage.getItem('user')
      const storedToken = localStorage.getItem('token')
      if (storedUser) this.user = JSON.parse(storedUser)
      if (storedToken) this.token = storedToken
    }
  }
})
