<template>
  <div class="tpl-card">
    <div class="hdr">
      <q-icon name="abc" class="q-mr-xs" /> Declare Var
      <q-space />
      <q-btn dense flat round size="sm" icon="close" @click.stop="$emit('remove', id)" />
    </div>

    <div class="row q-col-gutter-sm">
      <div class="col-4">
        <q-input v-model="name" dense label="Name" prefix="$" />
      </div>
      <div class="col">
        <q-input v-model="expr" dense label="Expression (Go-Template)" placeholder='.GetMIValue "video" "Width" 0' />
      </div>
    </div>

    <div class="handles">
      <div class="h out" data-id="out"></div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
const props = defineProps({ id:String, data:Object })
const emit  = defineEmits(['update:data', 'remove'])

const name = computed({
  get: () => props.data?.name || 'width',
  set: v => emit('update:data', { ...props.data, name: String(v || '').replace(/^\$/,'') })
})
const expr = computed({
  get: () => props.data?.expr || '.GetMIValue "video" "Width" 0',
  set: v => emit('update:data', { ...props.data, expr: v })
})
</script>

<style scoped>
.tpl-card{ position:relative; min-width:260px; background:#fff; border:1px solid #e5e7eb; border-radius:8px; padding:8px; }
.hdr{ font-weight:600; display:flex; align-items:center; margin-bottom:6px; }
.handles{ position:absolute; right:-6px; top:45%; pointer-events:none; }
.h{ position:absolute; width:12px; height:12px; border:2px solid #9ca3af; background:#fff; border-radius:50%; pointer-events:auto; }
.h.out{ right:-6px; }
.h::after{ position:absolute; left:14px; top:-4px; font-size:11px; opacity:.7; content:'out'; }
</style>
