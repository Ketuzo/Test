<template>
  <div class="tpl-card">
    <div class="hdr"><q-icon name="code" class="q-mr-xs" /> CLI-Flags</div>

    <div v-for="(row,i) in form.items" :key="i" class="row q-col-gutter-xs q-mb-xs">
      <div class="col-6"><q-input dense filled v-model="row[0]" label="Key (z.B. -r)" /></div>
      <div class="col-6"><q-input dense filled v-model="row[1]" label="Wert (optional)" /></div>
    </div>

    <div class="row q-col-gutter-xs">
      <div class="col">
        <q-btn dense outline icon="add" label="Zeile" @click="form.items.push(['',''])" />
      </div>
    </div>

    <div class="handles">
      <Handle type="target" id="in"  :position="Position.Left"  class="h-in" />
      <Handle type="source" id="out" :position="Position.Right" class="h-out" />
    </div>
  </div>
</template>

<script setup>
import { reactive, watch } from 'vue'
import { Handle, Position } from '@vue-flow/core'

const props = defineProps({ id:String, data:Object })
const emit  = defineEmits(['update:data'])

const form = reactive({ items: Array.isArray(props.data?.items) ? props.data.items.map(r => (Array.isArray(r)? r : [r?.k||'', r?.v||''])) : [['-r','25']] })
watch(form, () => emit('update:data', { items: form.items }), { deep:true })
</script>

<style scoped>
.tpl-card{ position:relative; min-width:260px; background:#fff; border:1px solid #e0e0e0; border-radius:8px; padding:8px; }
.hdr{ font-weight:600; margin-bottom:6px; }
:deep(.vue-flow__handle){ width:10px;height:10px;border:2px solid #fff;background:#555;border-radius:50%; }
.h-in{ left:-8px; top:50%; } .h-out{ right:-8px; top:50%; }
</style>
