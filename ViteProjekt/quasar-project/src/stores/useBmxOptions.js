import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useBmxOptions = defineStore('bmxOptions', () => {
  const list = ref([])
  const loaded = ref(false)

  async function load () {
    if (loaded.value) return
    const res = await fetch('/bmx_options.json')
    list.value = await res.json()
    loaded.value = true
  }

  return { list, load }
})
