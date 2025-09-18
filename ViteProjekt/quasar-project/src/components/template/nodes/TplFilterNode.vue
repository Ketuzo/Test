<template>
  <div class="tpl-card">
    <div class="hdr row items-center">
      <q-icon name="tune" class="q-mr-xs" />
      <span>Filter</span>
      <q-space />
      <q-btn dense flat round icon="close" @click="$emit('remove', id)" />
    </div>

    <div class="row items-center q-gutter-sm">
      <q-input v-model="name" dense filled label="name" style="max-width:150px" />
      <q-input v-model="argstr" dense filled label="args (key=val:…)" style="flex:1" />
    </div>

    <Handle type="target" id="in"  :position="Position.Left"  class="h-in" />
    <Handle type="source" id="out" :position="Position.Right" class="h-out" />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'

const props = defineProps({ id:String, data:Object })
const emit  = defineEmits(['update:data','remove'])

const name = computed({
  get: () => props.data?.name || 'scale',
  set: v  => emit('update:data', { ...props.data, name: v })
})
const argstr = computed({
  get: () => props.data?.argstr || '',
  set: v  => emit('update:data', { ...props.data, argstr: v })
})
</script>

<style scoped>
.tpl-card{ position:relative; min-width:280px; background:#fff; border:1px solid #e5e7eb; border-radius:8px; padding:10px; }
.hdr{ font-weight:600; margin-bottom:6px; }
:deep(.vue-flow__handle){ width:10px;height:10px;border:2px solid #fff;background:#555;border-radius:50%; }
.h-in{ left:-8px; top:50%; }
.h-out{ right:-8px; top:50%; }
</style>
