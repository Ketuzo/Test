<template>
  <div class="tpl-card">
    <div class="hdr"><q-icon name="save" class="q-mr-xs" /> Output</div>
    <q-select dense filled v-model="form.target" :options="[
      {label:'CLI (freie Zeilen)', value:'cli'},
      {label:'-vf (Filtergraph)', value:'vf'},
      {label:'-af (Filtergraph)', value:'af'},
    ]" emit-value map-options />
    <div class="handles">
      <Handle type="target" id="in" :position="Position.Left" class="h-in" />
    </div>
  </div>
</template>

<script setup>
import { reactive, watch } from 'vue'
import { Handle, Position } from '@vue-flow/core'

const props = defineProps({ id:String, data:Object })
const emit  = defineEmits(['update:data'])
const form = reactive({ target: props.data?.target || 'cli' })
watch(form, () => emit('update:data', { ...form }), { deep:true })
</script>

<style scoped>
.tpl-card{ position:relative; min-width:220px; background:#fff; border:1px solid #e0e0e0; border-radius:8px; padding:8px; }
.hdr{ font-weight:600; margin-bottom:6px; }
:deep(.vue-flow__handle){ width:10px;height:10px;border:2px solid #fff;background:#555;border-radius:50%; }
.h-in{ left:-8px; top:50%; }
</style>
