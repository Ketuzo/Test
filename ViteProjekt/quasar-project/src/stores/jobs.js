import { defineStore } from 'pinia'
import { api }         from 'boot/axios'
import { useAuthStore } from 'stores/auth'

export const useJobsStore = defineStore('jobs', {
  state: () => ({ list: [], sse: null }),

  actions: {
    async load({ limit = 10, skip = 0 } = {}) {
      const { data } = await api.get('/jobs', { params: { all:false, limit, skip } })
      this.bulk(data)
    },

    bulk(p) {
      (Array.isArray(p) ? p : p?.items ?? [p]).forEach(this.upsert)
    },

    upsert(job) {
      const i = this.list.findIndex(j => j._id === job._id)
      i === -1 ? this.list.unshift(job) : this.list.splice(i, 1, job)
    },

    startSSE() {
      if (this.sse) return

      const token = useAuthStore().getToken()
      const url   = '/api/jobs'

      this.sse = new EventSource(url, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })

      this.sse.onmessage = e => this.upsert(JSON.parse(e.data))
      this.sse.onerror   = () => this.stopSSE()
    },

    stopSSE() {
      this.sse?.close()
      this.sse = null
    }
  }
})
