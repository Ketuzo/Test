<!-- src/components/flow/FlowComp.vue -->
<template>
  <div class="flow-wrap" @dragover.prevent @drop="onDrop">
    <VueFlow
      v-model:nodes="nodes"
      v-model:edges="edges"
      :validate-connection="validateConnection"
      connection-mode="loose"
      :fit-view-on-init="true"
      @connect="onConnect"
      @edge-click="onEdgeClick"
      @edge-contextmenu="onEdgeContextMenu"
    >
      <Controls />
      <MiniMap />

      <!-- classic: Input / Output / Filter / Global -->
      <template #node-input-custom="p">
        <InputNode v-bind="p" @remove="removeNode(p.id)" @update:data="patchNodeData(p.id,$event)" />
      </template>

      <template #node-output-custom="p">
        <OutputNode v-bind="p" @remove="removeNode(p.id)" @update:data="patchNodeData(p.id,$event)" />
      </template>

      <template #node-filter="p">
        <FilterNode v-bind="p" @remove="removeNode(p.id)" @update:data="patchNodeData(p.id,$event)" />
      </template>

      <template #node-global="p">
        <CommandNode v-bind="p" @remove="removeNode(p.id)" @update:data="patchNodeData(p.id,$event)" />
      </template>
      <template #node-other="p">
        <CommandNode v-bind="p" @remove="removeNode(p.id)" @update:data="patchNodeData(p.id,$event)" />
      </template>

      <!-- template builder nodes -->
      <template #node-tpl-if="p">
        <TplIfNode v-bind="p" @remove="removeNode(p.id)" @update:data="patchNodeData(p.id,$event)" />
      </template>

      <template #node-tpl-filterchain="p">
        <TplFilterChainNode v-bind="p" @remove="removeNode(p.id)" @update:data="patchNodeData(p.id,$event)" />
      </template>

      <template #node-tpl-params="p">
        <TplParamsNode v-bind="p" @remove="removeNode(p.id)" @update:data="patchNodeData(p.id,$event)" />
      </template>

      <template #node-tpl-snippet="p">
        <TplSnippetNode v-bind="p" @remove="removeNode(p.id)" @update:data="patchNodeData(p.id,$event)" />
      </template>

      <template #node-tpl-output="p">
        <TplOutputNode v-bind="p" @remove="removeNode(p.id)" @update:data="patchNodeData(p.id,$event)" />
      </template>

      <template #node-tpl-var="p">
        <TplVarNode v-bind="p" @remove="removeNode(p.id)" @update:data="patchNodeData(p.id,$event)" />
      </template>
    </VueFlow>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { VueFlow, addEdge } from '@vue-flow/core'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/controls/dist/style.css'
import '@vue-flow/minimap/dist/style.css'

import InputNode  from './InputNode.vue'
import OutputNode from './OutputNode.vue'
import FilterNode from './FilterNode.vue'
import CommandNode from './CommandNode.vue'

import TplIfNode from '../template/nodes/TplIfNode.vue'
import TplFilterChainNode from '../template/nodes/TplFilterChainNode.vue'
import TplParamsNode from '../template/nodes/TplParamsNode.vue'
import TplSnippetNode from '../template/nodes/TplSnippetNode.vue'
import TplOutputNode from '../template/nodes/TplOutputNode.vue'
import TplVarNode from '../template/nodes/TplVarNode.vue'

import { categorizeOption } from 'src/utils/categorize'
import { getRawFlags } from 'src/utils/flags'

/* ---------------- helpers for classic edges (v/a/g) ---------------- */
function typeFromHandleId(id = '') {
  const m = String(id).match(/(?:^|[_-])([vag])(?:\d+)?$/i)
  return m ? m[1].toLowerCase() : null
}
function sameChannel(h1, h2) {
  const t1 = typeFromHandleId(h1)
  const t2 = typeFromHandleId(h2)
  return !!t1 && !!t2 && t1 === t2
}
function targetIndexFromHandle(id = '') {
  const m = String(id).match(/(?:^|_)([vag])(\d+)$/i)
  return m ? Number(m[2]) : 0
}

/* ---------------- helpers for template edges ---------------- */
const TPL_SRC = /^(then$|out_elif_\d+$|out$|else$)/i
const TPL_TGT = /^(body|in)$/i
function isTplHandle(id = '') {
  return TPL_SRC.test(id) || TPL_TGT.test(id)
}

/* ---------------- IO derivation for filters ---------------- */
function parseFilterIO(io = '', cat = 'video-filter') {
  // examples: "A×2→A", "AA→A", "A→A", "V×3→V", "A→N"
  const type = cat === 'audio-filter' ? 'a' : 'v'
  let ins = 1, outs = 1
  const s = String(io).toUpperCase().replace(/\s+/g, '')
  const m = s.match(/^([AVN×\d]+)->?([AVN×\d]+)$/) || s.match(/^([AVN×\d]+)→([AVN×\d]+)$/)
  if (m) {
    const L = m[1], R = m[2]
    // inputs
    const multL = L.match(/×(\d+)/); if (multL) ins = Number(multL[1])
    else if (/^A+$/i.test(L) || /^V+$/i.test(L)) ins = L.length
    else if (/^N$/i.test(L)) ins = 2
    // outputs
    const multR = R.match(/×(\d+)/); if (multR) outs = Number(multR[1])
    else if (/^A+$/i.test(R) || /^V+$/i.test(R)) outs = R.length
    else if (/^N$/i.test(R)) outs = 2
  }
  return { inputs: Array.from({ length: ins }, () => type), outputs: outs, type }
}

/* ---------------- graph state ---------------- */
const nodes = ref([
  {
    id: 'input-0',
    type: 'input-custom',
    position: { x: 20, y: 160 },
    data: { label: 'Input', path: './input.mp4', index: 0 },
  },
  {
    id: 'output-0',
    type: 'output-custom',
    position: { x: 980, y: 220 },
    data: { label: 'Output', path: './output.mp4', mapLabel: '' },
  },
])
const edges = ref([])

/* ---------------- validate + connect ---------------- */
function validateConnection(c) {
  // template branch: allow tpl-src -> tpl-target
  if (isTplHandle(c.sourceHandle) || isTplHandle(c.targetHandle)) {
    return TPL_SRC.test(c.sourceHandle || '') && TPL_TGT.test(c.targetHandle || '')
  }
  // classic streams
  if (!c?.sourceHandle || !c?.targetHandle) return false
  return sameChannel(c.sourceHandle, c.targetHandle)
}
function onConnect(c) {
  if (isTplHandle(c.sourceHandle) || isTplHandle(c.targetHandle)) {
    edges.value = addEdge({ ...c, data: { kind: 'tpl' } }, edges.value)
    return
  }
  if (!sameChannel(c.sourceHandle, c.targetHandle)) return
  const ch = typeFromHandleId(c.sourceHandle || '')
  const tIndex = targetIndexFromHandle(c.targetHandle || '')
  edges.value = addEdge({ ...c, data: { type: ch, tIndex } }, edges.value)
}

/* ---------------- edge remove helpers ---------------- */
function removeEdgeById(id) { edges.value = edges.value.filter(e => e.id !== id) }
function onEdgeClick(evt) {
  const { edge, event } = evt || {}
  if (!edge || !event) return
  if (event.altKey || event.ctrlKey || event.metaKey) removeEdgeById(edge.id)
}
function onEdgeContextMenu(evt) {
  if (!evt?.edge) return
  evt?.event?.preventDefault?.()
  removeEdgeById(evt.edge.id)
}

/* ---------------- node utils ---------------- */
function patchNodeData(id, patch) {
  nodes.value = nodes.value.map(n =>
    n.id === id ? { ...n, data: { ...(n.data || {}), ...(patch || {}) } } : n
  )
}
function removeNode(id) {
  nodes.value = nodes.value.filter(n => n.id !== id)
  edges.value = edges.value.filter(e => e.source !== id && e.target !== id)
}
function nextInputIndex() {
  const idxs = nodes.value.filter(n => n.type === 'input-custom').map(n => Number(n.data?.index ?? 0))
  return idxs.length ? Math.max(...idxs) + 1 : 0
}
function addInput(y = 100) {
  const i = nextInputIndex()
  nodes.value.push({
    id: `input-${Date.now()}`,
    type: 'input-custom',
    position: { x: 20, y },
    data: { label: 'Input', path: './input.mp4', index: i },
  })
}

/* ---------------- drop routing ---------------- */
function onDrop(e) {
  const raw = e.dataTransfer.getData('application/json')
  if (!raw) return
  const payload = JSON.parse(raw)
  const pos = { x: e.offsetX, y: e.offsetY }

  // 0) quick actions
  if (payload.type === 'input') { addInput(pos.y); return }

  // 1) TEMPLATE blocks (note: CommandPalette sends "kind")
  if (payload.kind === 'tpl-if') {
    nodes.value.push({
      id: `tplif-${Date.now()}`,
      type: 'tpl-if',
      position: pos,
      data: { clauses: [{ left: '$x', op: 'eq', right: '1' }], hasElse: true }
    })
    return
  }
  if (payload.kind === 'tpl-filterchain') {
    nodes.value.push({
      id: `tpfc-${Date.now()}`,
      type: 'tpl-filterchain',
      position: pos,
      data: { chain: [] } // items: {name, params:{k:v}}
    })
    return
  }
  if (payload.kind === 'tpl-params') {
    nodes.value.push({
      id: `tpp-${Date.now()}`,
      type: 'tpl-params',
      position: pos,
      data: { items: [] } // [['-c:v','libx264']]
    })
    return
  }
  if (payload.kind === 'tpl-snippet') {
    nodes.value.push({
      id: `tps-${Date.now()}`,
      type: 'tpl-snippet',
      position: pos,
      data: { body: String(payload.template || '// (leer)') }
    })
    return
  }
  if (payload.kind === 'tpl-output') {
    nodes.value.push({
      id: `tpo-${Date.now()}`,
      type: 'tpl-output',
      position: pos,
      data: { target: 'cli' } // 'vf' | 'af' | 'cli'
    })
    return
  }
  if (payload.kind === 'tpl-var') {
    nodes.value.push({
      id: `tpv-${Date.now()}`,
      type: 'tpl-var',
      position: pos,
      data: { name: '$x', expr: '.GetMIValue "video" "Width" 0' }
    })
    return
  }

  // 2) filter group
  if (payload.type === 'filter-group') {
    const isGlobal = /global options/i.test(payload.group) || payload.cat === 'global'
    const sample = payload.options?.[0] || {}
    const flags = getRawFlags(payload) || getRawFlags(sample) || ''
    const cat = isGlobal ? 'global' : (payload.cat || 'video-filter')
    let inputs = isGlobal ? ['g'] : [(cat === 'audio-filter') ? 'a' : 'v']
    let outputs = 1
    if (sample.filter_io && !isGlobal) {
      const d = parseFilterIO(sample.filter_io, cat)
      inputs = d.inputs; outputs = d.outputs
    }

    nodes.value.push({
      id: `f-${Date.now()}`,
      type: isGlobal ? 'global' : 'filter',
      position: pos,
      data: {
        cat,
        group: payload.group,
        options: payload.options || [],
        inputs, outputs,
        filterDesc: sample.filter_description || sample.description || '',
        filter_flags_code: flags,
      },
    })
    return
  }

  // 3) single option
  const cat = categorizeOption(payload).cat // 'global'|'other'|'audio-filter'|'video-filter'
  const flags = getRawFlags(payload)
  let inputs = (cat === 'audio-filter') ? ['a'] : (cat === 'global' || cat === 'other') ? ['g'] : ['v']
  let outputs = 1
  if (payload.filter_io && (cat === 'audio-filter' || cat === 'video-filter')) {
    const d = parseFilterIO(payload.filter_io, cat)
    inputs = d.inputs; outputs = d.outputs
  }

  nodes.value.push({
    id: `n-${Date.now()}`,
    type: (cat === 'global' || cat === 'other') ? cat : 'filter',
    position: pos,
    data: {
      ...payload,
      cat,
      value: '',
      inputs, outputs,
      filter_flags_code: flags,
      filterDesc: payload.filter_description || payload.description || '',
    },
  })
}

/* ---------------- expose ---------------- */
defineExpose({
  getState: () => ({ nodes: nodes.value, edges: edges.value }),
  addInput,
})
</script>

<style scoped>
.flow-wrap { position:relative; width:100%; height:100%; }

/* handle badges */
:deep(.vue-flow__handle){ position:absolute; width:10px;height:10px;border:2px solid #fff;border-radius:50%;background:#555; }
:deep(.vue-flow__handle)::after{
  position:absolute; top:-4px; left:12px; padding:0 6px; font-size:10px; line-height:14px;
  border-radius:10px; font-weight:600; pointer-events:none; user-select:none; content:'';
}
/* v (blue) */
:deep(.vue-flow__handle[id^="v"])::after, :deep(.vue-flow__handle[id*="_v"])::after{ content:'v'; color:#1e88e5; background:#e8f0ff; }
/* a (purple) */
:deep(.vue-flow__handle[id^="a"])::after, :deep(.vue-flow__handle[id*="_a"])::after{ content:'a'; color:#6a1b9a; background:#f5e8ff; }
/* g (green) */
:deep(.vue-flow__handle[id^="g"])::after, :deep(.vue-flow__handle[id*="_g"])::after{ content:'g'; color:#2e7d32; background:#e8f5e9; }

/* colours for node cards (like before) */
:deep(.cat-video-filter){ background:#fffbea; }
:deep(.cat-audio-filter){ background:#f5f0ff; }
:deep(.cat-global){ background:#f8fafc; }
</style>
