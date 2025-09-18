<template>
  <div class="tpl-card">
    <div class="hdr row items-center">
      <q-icon name="sync" class="q-mr-xs" /><span>Range (for-loop)</span>
      <q-space /><q-btn dense flat round icon="close" @click="$emit('remove', id)" />
    </div>

    <q-input v-model="expr" dense filled label="Expression"
             hint='z. B. until (int (.GetNumberOfAudioChannels))' />

    <Handle type="target" id="in"   :position="Position.Left"  class="h-in" />
    <Handle type="source" id="body" :position="Position.Right" class="h-out" />

    <div class="labels">
      <span class="h-label l" style="top:50%">in</span>
      <span class="h-label r" style="top:50%">body</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
const props = defineProps({ id:String, data:Object })
const emit  = defineEmits(['update:data','remove'])
const expr = computed({
  get: () => props.data?.expr || 'until (int (.GetNumberOfAudioChannels))',
  set: v  => emit('update:data', { ...props.data, expr: v })
})
</script>

<style scoped>
.tpl-card{ position:relative; min-width:300px; background:#fff; border:1px solid #e5e7eb; border-radius:8px; padding:10px; }
.hdr{ font-weight:600; }
:deep(.vue-flow__handle){ width:10px;height:10px;border:2px solid #fff;background:#555;border-radius:50%; }
.h-in{ left:-8px; top:50%; }
.h-out{ right:-8px; top:50%; }
.labels{ position:absolute; inset:0; pointer-events:none; font-size:12px; opacity:.7; }
.h-label{ position:absolute; transform:translateY(-7px); }
.h-label.l{ left:-2px; }
.h-label.r{ right:-2px; }
</style>
