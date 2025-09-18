<template>
  <div class="io-node out">
    <div class="title">Output</div>
    <q-input dense filled v-model="model.path" placeholder="./output.mp4" class="q-mt-xs" @keyup.stop />

    <div class="ports left">
      <Handle type="target" id="v0" :position="Position.Left" :style="{ top: TOP_V }" class="port-v" />
      <span class="lbl l-left" :style="{ top: TOP_V }">v</span>

      <Handle type="target" id="g0" :position="Position.Left" :style="{ top: TOP_G }" class="port-g" />
      <span class="lbl l-left" :style="{ top: TOP_G }">g</span>

      <Handle type="target" id="a0" :position="Position.Left" :style="{ top: TOP_A }" class="port-a" />
      <span class="lbl l-left" :style="{ top: TOP_A }">a</span>
    </div>
  </div>
</template>

<script setup>
import { reactive, watch } from 'vue'
import { Handle, Position } from '@vue-flow/core'
const props = defineProps({ data: Object })
const emit  = defineEmits(['update:data'])

const model = reactive({ path: props.data?.path || './output.mp4' })
watch(model, () => emit('update:data', model), { deep: true })

const TOP_V = '44px'
const TOP_G = '66px'
const TOP_A = '88px'
</script>

<style scoped>
.io-node{ position:relative; background:#f2fff2; border:1px solid #cfeccc; border-radius:8px; padding:8px; min-width:190px; }
.title{ font-weight:700; margin-bottom:4px; }

.ports{ position:absolute; top:0; left:-10px; width:0; }
.lbl{ position:absolute; left:10px; transform:translateY(-7px); font-size:12px; opacity:.7; pointer-events:none; }

.port-v :deep(.vue-flow__handle){ width:12px; height:12px; border:2px solid #60a5fa; background:#f2fff2; }
.port-a :deep(.vue-flow__handle){ width:12px; height:12px; border:2px solid #a855f7; background:#f2fff2; }
.port-g :deep(.vue-flow__handle){ width:12px; height:12px; border:2px solid #9ca3af; background:#f2fff2; }
</style>
