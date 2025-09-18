<template>
  <div class="inspector q-pa-md">
    <div class="row items-center q-gutter-sm q-mb-sm">
      <div class="text-subtitle2 ellipsis">{{ title }}</div>
      <q-badge dense>{{ badge }}</q-badge>
      <q-chip dense square class="chip-io">{{ ioSig }}</q-chip>
      <q-chip v-if="hasT" dense square outline class="chip-flag">T</q-chip>
      <q-chip v-if="hasS" dense square outline class="chip-flag">S</q-chip>
      <q-chip v-if="hasC" dense square outline class="chip-flag">C</q-chip>
    </div>

    <q-item-label caption class="q-mb-md">{{ desc }}</q-item-label>

    <q-separator spaced />

    <div class="q-mb-sm"><strong>Inputs:</strong> {{ inPorts.join(', ') }}</div>
    <div class="q-mb-sm"><strong>Outputs:</strong> {{ outCount }}</div>

    <div v-if="(node.data?.outLabels||[]).length" class="q-mb-sm">
      <strong>Output labels:</strong>
      <div class="q-mt-xs">
        <q-chip v-for="(l,i) in node.data.outLabels" :key="i" dense>{{ l || `${node.id}_${badge.toLowerCase()}${i}` }}</q-chip>
      </div>
    </div>

    <div v-if="node.data?.enable" class="q-mb-sm">
      <strong>enable=</strong>
      <div class="mono">{{ node.data.enable }}</div>
    </div>

    <div v-if="node.data?.instance || node.data?.sendcmd" class="q-mb-sm">
      <strong>sendcmd / @instance</strong>
      <div class="mono">instance: {{ node.data.instance || '(none)' }}</div>
      <div class="mono q-mt-xs">{{ node.data.sendcmd }}</div>
    </div>

    <div v-if="(node.data?.params||[]).length" class="q-mt-md">
      <strong>Options:</strong>
      <div class="q-mt-xs">
        <div v-for="p in node.data.params" :key="p.k" class="row items-center q-gutter-sm">
          <q-chip dense>{{ p.k }}</q-chip>
          <span class="mono">{{ p.v }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
const props = defineProps({ node: Object })
const node = computed(()=> props.node || {})

const title = computed(()=> node.value?.data?.group || node.value?.data?.key || 'Filter')
const desc  = computed(()=> node.value?.data?.filterDesc || node.value?.data?.description || '')
const cat   = computed(()=> node.value?.data?.cat)
const badge = computed(()=> (cat.value==='audio-filter'?'A':(cat.value==='global' || cat.value==='other')?'G':'V'))
const inPorts = computed(()=> node.value?.data?.inputs || [(badge.value==='A')?'a':(badge.value==='G')?'g':'v'])
const outCount= computed(()=> Number(node.value?.data?.outputs ?? 1))
const flags   = computed(()=> node.value?.data?.filter_flags_code || '')
const hasT    = computed(()=> /t/.test(flags.value))
const hasS    = computed(()=> /s/.test(flags.value))
const hasC    = computed(()=> /c/.test(flags.value))

const ioSig = computed(()=>{
  const i = `${badge.value}×${inPorts.value.length}`
  const o = `${badge.value}${outCount.value>1?`×${outCount.value}`:''}`
  return `${i}→${o}`
})
</script>

<style scoped>
.inspector { font-size:13px; }
.chip-io { background:#eef2ff; color:#3730a3; }
.chip-flag { border-color:#9ca3af; color:#374151; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, "Liberation Mono", "Courier New", monospace; white-space: pre-wrap; }
</style>
