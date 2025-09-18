<!-- src/components/flow/FlowComp.vue -->
<template>
  <div class="flow-wrap">
    <VueFlow
      v-model:nodes="nodes"
      v-model:edges="edges"
      :validate-connection="validateConnection"
      connection-mode="loose"
      :fit-view-on-init="true"
      @connect="onConnect"
      @edge-click="onEdgeClick"
      @edge-contextmenu="onEdgeContextMenu"
      @dragenter.prevent
      @dragover.prevent="onDragOver"
      @drop="onDrop"
    >
      <Controls />
      <MiniMap />

      <!-- classic -->
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

      <!-- template builder -->
      <template #node-tpl-if="p">
        <TplIfNode v-bind="p" @remove="removeNode(p.id)" @update:data="patchNodeData(p.id,$event)" />
      </template>
      <template #node-tpl-range="p">
        <TplRangeNode v-bind="p" @remove="removeNode(p.id)" @update:data="patchNodeData(p.id,$event)" />
      </template>
      <template #node-tpl-filterchain="p">
        <TplFilterChainNode v-bind="p" @remove="removeNode(p.id)" />
      </template>
      <template #node-tpl-filter="p">
        <TplFilterNode v-bind="p" @remove="removeNode(p.id)" @update:data="patchNodeData(p.id,$event)" />
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
import { VueFlow, addEdge, useVueFlow } from '@vue-flow/core'
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
import TplRangeNode from '../template/nodes/TplRangeNode.vue'
import TplFilterChainNode from '../template/nodes/TplFilterChainNode.vue'
import TplFilterNode from '../template/nodes/TplFilterNode.vue'
import TplParamsNode from '../template/nodes/TplParamsNode.vue'
import TplSnippetNode from '../template/nodes/TplSnippetNode.vue'
import TplOutputNode from '../template/nodes/TplOutputNode.vue'
import TplVarNode from '../template/nodes/TplVarNode.vue'

/* classic stream helpers (v/a/g) */
function typeFromHandleId(id = ''){ const m = String(id).match(/(?:^|[_-])([vag])(?:\d+)?$/i); return m ? m[1].toLowerCase() : null }
function sameChannel(h1,h2){ const t1=typeFromHandleId(h1), t2=typeFromHandleId(h2); return !!t1 && !!t2 && t1===t2 }
function targetIndexFromHandle(id = ''){ const m = String(id).match(/(?:^|_)([vag])(\d+)$/i); return m ? Number(m[2]) : 0 }

/* template handle rules */
const TPL_SRC = /^(then$|elif-\d+$|out_elif_\d+$|else$|out$)/i
const TPL_TGT = /^(body|in)$/i
function isTplHandle(id=''){ return TPL_SRC.test(id) || TPL_TGT.test(id) }

/* vue-flow helpers we actually use */
const { project, getNodes } = useVueFlow()

/* graph state */
const nodes = ref([
  { id: 'input-0',  type:'input-custom',  position:{ x:20,  y:160 }, data:{ label:'Input',  path:'./input.mp4',  index:0 } },
  { id: 'output-0', type:'output-custom', position:{ x:980, y:220 }, data:{ label:'Output', path:'./output.mp4', mapLabel:'' } },
])
const edges = ref([])

/* connect + validate */
function validateConnection(c){
  if (isTplHandle(c.sourceHandle) || isTplHandle(c.targetHandle)) {
    return TPL_SRC.test(c.sourceHandle||'') && TPL_TGT.test(c.targetHandle||'')
  }
  if (!c?.sourceHandle || !c?.targetHandle) return false
  return sameChannel(c.sourceHandle, c.targetHandle)
}
function onConnect(c){
  if (isTplHandle(c.sourceHandle) || isTplHandle(c.targetHandle)) {
    edges.value = addEdge({ ...c, data:{ kind:'tpl' } }, edges.value); return
  }
  if (!sameChannel(c.sourceHandle, c.targetHandle)) return
  const ch = typeFromHandleId(c.sourceHandle||'')
  const tIndex = targetIndexFromHandle(c.targetHandle||'')
  edges.value = addEdge({ ...c, data:{ type: ch, tIndex } }, edges.value)
}

/* edge utils */
function removeEdgeById(id){ edges.value = edges.value.filter(e => e.id !== id) }
function onEdgeClick(evt){ const { edge, event } = evt||{}; if (!edge||!event) return; if (event.altKey||event.ctrlKey||event.metaKey) removeEdgeById(edge.id) }
function onEdgeContextMenu(evt){ if (!evt?.edge) return; evt?.event?.preventDefault?.(); removeEdgeById(evt.edge.id) }

/* node utils */
function patchNodeData(id, patch){
  nodes.value = nodes.value.map(n => n.id===id ? { ...n, data: { ...(n.data||{}), ...(patch||{}) } } : n)
}
function removeNode(id){
  nodes.value = nodes.value.filter(n => n.id !== id)
  edges.value = edges.value.filter(e => e.source !== id && e.target !== id)
}

/* ids/coords helpers */
function uid(p){ return `${p}-${Math.random().toString(36).slice(2,8)}` }
function onDragOver(e){ e.dataTransfer.dropEffect = 'copy' }
function flowPointFromEvent(e){
  const pane = e.currentTarget?.querySelector?.('.vue-flow__pane') || e.currentTarget
  const b = pane.getBoundingClientRect()
  const pt = { x: e.clientX - b.left, y: e.clientY - b.top }
  return typeof project === 'function' ? project(pt) : pt
}

/* Chain unter Cursor erkennen */
function chainAtPoint(p){
  const all = getNodes().filter(n => n.type === 'tpl-filterchain')
  return all.find(n => {
    const w = n.dimensions?.width ?? 0, h = n.dimensions?.height ?? 0
    return p.x>=n.position.x && p.x<=n.position.x+w && p.y>=n.position.y && p.y<=n.position.y+h
  })
}

/* Payload robust lesen (application/json ODER text/plain) */
function readPayload(e){
  const types = Array.from(e.dataTransfer?.types || [])
  let raw = ''
  if (types.includes('application/json')) raw = e.dataTransfer.getData('application/json')
  if (!raw && types.includes('text/plain')) raw = e.dataTransfer.getData('text/plain')
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

/* -------- Template-Filter (für Chains) -------- */
function linkTpl(aId,aHandle,bId,bHandle){
  edges.value = addEdge({ source:aId, sourceHandle:aHandle, target:bId, targetHandle:bHandle, data:{kind:'tpl'} }, edges.value)
}
function spawnTplFilter(name, pos, lane=null, order=0){
  const id = uid('tplf')
  nodes.value.push({ id, type:'tpl-filter', position: pos, data:{ name, argstr:'', laneId: lane?.id || null, order } })
  return id
}
function laneFilters(chainId){
  return nodes.value
    .filter(n => n.type==='tpl-filter' && n.data?.laneId===chainId)
    .sort((a,b)=> (a.data?.order??0) - (b.data?.order??0))
}
function addFiltersToChain(names, chain){
  const w = chain.dimensions?.width ?? 260
  const startX = chain.position.x + w + 24
  const startY = chain.position.y + 20
  const existing = laneFilters(chain.id)
  const baseOrder = existing.length ? Math.max(...existing.map(n=>n.data?.order??0)) + 1 : 1
  const ids = names.map((nm,i)=> spawnTplFilter(nm, { x:startX, y:startY + i*72 }, chain, baseOrder+i))
  if (!existing.length && ids.length) linkTpl(chain.id, 'out', ids[0], 'in')
  if (existing.length && ids.length)  linkTpl(existing[existing.length-1].id, 'out', ids[0], 'in')
  for (let i=0;i<ids.length-1;i++) linkTpl(ids[i],'out',ids[i+1],'in')
}

/* -------- Klassische Filter (für Workflows ohne Template) -------- */
function spawnClassicFilter(name, pos, meta = {}){
  const id = uid('f')
  nodes.value.push({
    id, type:'filter', position: pos,
    data: {
      label: name,
      option: name,
      description: meta?.description || '',
      cat: meta?.cat || meta?.category || 'video-filter',
      filter_io: meta?.filter_io || '',
      args: ''
    }
  })
  return id
}
function addClassicFilters(names, p, metaSource){
  const meta = Array.isArray(metaSource?.options) ? metaSource.options[0] : metaSource
  names.forEach((nm,i)=> spawnClassicFilter(nm, { x:p.x, y:p.y + i*84 }, meta))
}

/* Payload → Filternamen extrahieren (option ODER name) */
function namesFromPayload(p){
  const names=[]
  const push = (v)=> { if (typeof v==='string' && v) names.push(v.replace(/^-+/,'')) }

  if (p?.type==='filter-group' && Array.isArray(p.options)) {
    p.options.forEach(o=> push(o?.option || o?.name))
    return names
  }
  if (p && (typeof p.option==='string' || typeof p.name==='string')) {
    push(p.option || p.name)
    return names
  }
  if (p?.kind==='group' && Array.isArray(p.items)) {
    p.items.forEach(it=> push(it?.option || it?.name))
    return names
  }
  if (p?.kind==='option') {
    push(p.option || p.name)
    return names
  }
  return names
}

/* drop routing (Pane-weit) */
function onDrop(e){
  const payload = readPayload(e); if (!payload) return
  const p = flowPointFromEvent(e)

  // template blocks
  if (payload.kind === 'tpl-if')     { nodes.value.push({ id:uid('tplif'), type:'tpl-if',        position:p, data:{ clauses:[{ left:'$width', op:'lt', right:'1080' }], hasElse:true } }); return }
  if (payload.kind === 'tpl-range')  { nodes.value.push({ id:uid('tplrng'), type:'tpl-range',     position:p, data:{ expr:'until (int (.GetNumberOfAudioChannels))' } }); return }
  if (payload.kind === 'tpl-filterchain'){ nodes.value.push({ id:uid('tplfc'), type:'tpl-filterchain', position:p, data:{} }); return }
  if (payload.kind === 'tpl-output') { nodes.value.push({ id:uid('tplout'), type:'tpl-output',   position:p, data:{} }); return }
  if (payload.kind === 'tpl-var')    { nodes.value.push({ id:uid('tplvar'), type:'tpl-var',       position:p, data:{ name:'$width', expr:'.GetMIValue "video" "Width" 0' } }); return }
  if (payload.kind === 'tpl-snippet'){ nodes.value.push({ id:uid('tplsn'), type:'tpl-snippet',    position:p, data:{ body: payload.body || '' } }); return }

  // sprig → snippet
  if (payload.type === 'sprig-fn' || payload.type === 'sprig-preset') {
    nodes.value.push({ id:uid('tplsn'), type:'tpl-snippet', position:p, data:{ body: payload.template || '' } })
    return
  }

  // ffmpeg/bmx → klassisch oder templated
  const names = namesFromPayload(payload)
  if (!names.length) return

  const chain = chainAtPoint(p)
  if (chain) addFiltersToChain(names, chain)   // templated
  else addClassicFilters(names, p, payload)    // klassisch
}
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

/* colours for node cards (optional) */
:deep(.cat-video-filter){ background:#fffbea; }
:deep(.cat-audio-filter){ background:#f5f0ff; }
:deep(.cat-global){ background:#f8fafc; }
</style>
