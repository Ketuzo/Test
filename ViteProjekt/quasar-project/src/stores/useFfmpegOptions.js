import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useFfmpegOptions = defineStore('ffmpegOptions', () => {
  const list   = ref([])
  const loaded = ref(false)

  async function load () {
    if (loaded.value) return
    const res = await fetch('/ffmpeg_options_augmented.json')
    list.value = await res.json()
    loaded.value = true
  }

  return { list, load }
})
