<template>
  <div class="cmd-preview">
    <div class="row items-center q-gutter-sm">
      <q-icon name="terminal" />
      <div class="text-caption text-grey-7">FFmpeg</div>
      <q-space />
      <q-btn dense flat icon="content_copy" @click="copy" />
    </div>
    <pre class="mono">{{ cmd }}</pre>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { buildFFmpegCommand } from 'src/lib/exporter'

const props = defineProps({
  nodes: { type: Array, required: true },
  edges: { type: Array, required: true }
})

const cmd = computed(() => {
  try {
    const out = buildFFmpegCommand({ nodes: props.nodes, edges: props.edges })
    return out?.cmd || ''
  } catch {
    return '# Fehler beim Erzeugen des Kommandos'
  }
})

function copy () {
  navigator.clipboard?.writeText(cmd.value)
}
</script>

<style scoped>
.cmd-preview{
  position: absolute; left: 8px; bottom: 8px; z-index: 10;
  width: min(900px, 70vw);
  background: #0b1022; color: #e7ebff;
  border: 1px solid #263053; border-radius: 8px;
  padding: 8px 10px; box-shadow: 0 6px 14px rgba(0,0,0,.25);
}
.mono{ font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; white-space: pre-wrap; word-break: break-all; margin: 4px 0 0; }
</style>
