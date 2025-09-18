import { defineStore } from 'pinia'
import { api }         from 'boot/axios'
import { jwtDecode }   from 'jwt-decode'

export const useAuthStore = defineStore('auth', {

  state: () => ({
    token  : null,   // Access-Token (JWT)
    refresh: null    // Refresh-Token
  }),

  persist: true,

  getters: {
    isLogged: (s) => !!s.token,

    isAuthenticated () { return this.isLogged },

    user: (s) => (s.token ? jwtDecode(s.token) : null)
  },


  actions: {

    getToken () { return this.token },

    async login (username, password) {
      const { data } = await api.post('/auth/login', { user: username, pass: password })
      this.setCreds(data)
    },


    setCreds ({ access, refresh }) {
      this.token   = access
      this.refresh = refresh
    },

    async refreshToken () {
      if (!this.refresh) throw new Error('Kein Refresh-Token vorhanden')
      const { data } = await api.post('/auth/refresh', { refresh: this.refresh })
      this.token = data.access      // nur Access wird erneuert
    },


    logout () {
      this.token   = null
      this.refresh = null
    }
  }
})
