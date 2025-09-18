<template>
  <div class="tpl-if">
    <div class="hdr row items-center">
      <q-icon name="splitscreen" class="q-mr-xs" />
      <span>If / Else</span>
      <q-space />
      <q-btn dense flat round icon="close" @click="$emit('remove', id)" />
    </div>

    <div class="row q-col-gutter-sm q-mt-xs">
      <div class="col-5">
        <q-input v-model="first.left" dense filled label="Left (Var/Expr)" />
      </div>
      <div class="col-2">
        <q-select v-model="first.op" :options="OPS" dense filled label="Op" emit-value map-options />
      </div>
      <div class="col">
        <q-input v-model="first.right" dense filled label="Right (value)" />
      </div>
    </div>

    <div class="q-mt-sm">
      <q-btn size="sm" outline icon="add" label="ELIF" @click="addElif" />
      <q-toggle v-model="hasElse" class="q-ml-md" label="Else-Zweig" />
    </div>

    <div v-for="(cl,i) in elifs" :key="i" class="row q-col-gutter-sm q-mt-xs">
      <div class="col-5"><q-input v-model="cl.left" dense filled label="Elif left" /></div>
      <div class="col-2"><q-select v-model="cl.op" :options="OPS" dense filled label="Op" emit-value map-options /></div>
      <div class="col"><q-input v-model="cl.right" dense filled label="Elif right" /></div>
      <div class="col-auto"><q-btn dense flat round icon="close" @click="removeElif(i)" /></div>
    </div>

    <!-- template handles (source) -->
    <Handle type="source" id="then"      :position="Position.Right" class="tpl-h" :style="{ top:'36px' }" />
    <span class="h-label r" :style="{ top:'36px' }">then</span>

    <template v-for="(cl,i) in elifs" :key="'elif'+i">
      <Handle type="source" :id="'out_elif_'+i" :position="Position.Right" class="tpl-h"
              :style="{ top: `${72 + i*36}px` }" />
      <span class="h-label r" :style="{ top: `${72 + i*36}px` }">elif {{ i }}</span>
    </template>

    <Handle v-if="hasElse" type="source" id="else" :position="Position.Right" class="tpl-h"
            :style="{ top: `${ 72 + elifs.length*36 }px` }" />
    <span v-if="hasElse" class="h-label r" :style="{ top: `${ 72 + elifs.length*36 }px` }">else</span>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { Handle, Position } from '@vue-flow/core'

const props = defineProps({ id:String, data:Object })
const emit  = defineEmits(['update:data','remove'])

const OPS = [
  { label:'eq', value:'eq' }, { label:'ne', value:'ne' },
  { label:'gt', value:'gt' }, { label:'lt', value:'lt' },
]

const first = ref({
  left : props.data?.clauses?.[0]?.left  ?? '$x',
  op   : props.data?.clauses?.[0]?.op    ?? 'eq',
  right: props.data?.clauses?.[0]?.right ?? '1',
})
const elifs   = ref((props.data?.clauses || []).slice(1))
const hasElse = ref(!!props.data?.hasElse)

function addElif(){ elifs.value.push({ left:'$x', op:'eq', right:'1' }) }
function removeElif(i){ elifs.value.splice(i,1) }

watch([first, elifs, hasElse], () => {
  emit('update:data', {
    ...props.data,
    clauses: [first.value, ...elifs.value],
    hasElse: hasElse.value
  })
}, { deep:true })
</script>

<style scoped>
.tpl-if{ position:relative; background:#fff; border:1px solid #e5e7eb; border-radius:10px; padding:10px; min-width:360px; }
.hdr{ font-weight:600; }
.tpl-h:deep(.vue-flow__handle){ width:12px;height:12px;border:2px solid #9ca3af;background:#fff; }
.h-label{ position:absolute; transform:translateY(-7px); font-size:12px; opacity:.7; pointer-events:none; }
.h-label.r{ right:-2px; }
</style>
