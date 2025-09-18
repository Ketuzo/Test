<template>
  <div class="tpl-lane" @dragover.prevent @drop="onDrop">
    <div class="hdr row items-center">
      <q-icon name="tune" class="q-mr-xs" />
      <span>Filter Chain</span>
      <q-space />
      <q-btn dense flat round icon="close" @click="$emit('remove', id)" />
    </div>

    <div class="hint">Drop FFmpeg-Filter oder Gruppen hier → es werden echte Filter-Nodes erstellt und angekettet.</div>

    <!-- Lane-Handles (Template) -->
    <Handle type="target" id="in"  :position="Position.Left"  class="h-in"  />
    <Handle type="source" id="out" :position="Position.Right" class="h-out" />
  </div>
</template>

<script setup>
import { useVueFlow, Handle, Position, addEdge } from '@vue-flow/core'

const props = defineProps({ id:String, data:Object })
defineEmits(['remove'])

const { findNode, addNodes, getNodes, getEdges, setEdges } = useVueFlow()

function uid (p){ return `${p}-${Math.random().toString(36).slice(2,8)}` }

function laneBox(){
  const me = findNode(props.id)
  const w  = me?.dimensions?.width ?? 260
  const h  = me?.dimensions?.height ?? 120
  const x  = me?.position?.x ?? 0
  const y  = me?.position?.y ?? 0
  return { x, y, w, h }
}

function laneFilters(){
  return getNodes().filter(n => n.type === 'tpl-filter' && n.data?.laneId === props.id)
                   .sort((a,b)=> (a.data?.order??0) - (b.data?.order??0))
}

function addFilterNode(name, order, yOff){
  const { x, y, w } = laneBox()
  const id = uid('tplf')
  addNodes([{
    id,
    type: 'tpl-filter',
    position: { x: x + w + 24, y: y + 20 + yOff },
    data: { name, argstr:'', laneId: props.id, order }
  }])
  return id
}

function link(aId, aHandle, bId, bHandle){
  setEdges(addEdge({
    source: aId, sourceHandle: aHandle,
    target: bId, targetHandle: bHandle,
    data: { kind: 'tpl' }
  }, getEdges()))
}

function connectChain(newIds){
  const existing = laneFilters()
  const lastExisting = existing[existing.length - 1]
  // 1) von Lane->out zu erstem neuen Filter
  if (!existing.length && newIds.length){
    link(props.id, 'out', newIds[0], 'in')
  } else if (lastExisting && newIds.length){
    link(lastExisting.id, 'out', newIds[0], 'in')
  }
  // 2) neue untereinander
  for (let i=0;i<newIds.length-1;i++){
    link(newIds[i], 'out', newIds[i+1], 'in')
  }
  // 3) Ende: Nutzer verbindet letzten Filter -> (weiterer Block/Output)
}

function onDrop (e) {
  const raw = e.dataTransfer.getData('application/json')
  if (!raw) return
  let p; try { p = JSON.parse(raw) } catch { return }

  const names = []

  // Deine Gruppen (CommandPalette): type:'filter-group'
  if (p?.type === 'filter-group' && Array.isArray(p.options)) {
    p.options.forEach(o => o?.option && names.push(String(o.option).replace(/^-+/,'')))
  }
  // Einzelne FFmpeg-Option (rohes Objekt)
  else if (p && typeof p.option === 'string') {
    names.push(String(p.option).replace(/^-+/, ''))
  }
  // Fallback: unsere "kind"-Variante
  else if (p?.kind === 'group' && Array.isArray(p.items)) {
    p.items.forEach(it => it?.option && names.push(String(it.option).replace(/^-+/,'')))
  } else if (p?.kind === 'option' && typeof p.option === 'string') {
    names.push(String(p.option).replace(/^-+/, ''))
  }

  if (!names.length) return

  const baseOrder = laneFilters().reduce((m,n)=>Math.max(m, n.data?.order??0), 0) + 1
  const newIds = names.map((nm, i) => addFilterNode(nm, baseOrder + i, i*72))
  connectChain(newIds)
}
</script>

<style scoped>
.tpl-lane{ position:relative; min-width:320px; min-height:110px; background:#fff; border:1px dashed #9aa2af; border-radius:10px; padding:10px; }
.hdr{ font-weight:600; margin-bottom:4px; }
.hint{ font-size:12px; opacity:.7; }
:deep(.vue-flow__handle){ width:10px;height:10px;border:2px solid #fff;background:#555;border-radius:50%; }
.h-in{ left:-8px; top:50%; }
.h-out{ right:-8px; top:50%; }
</style>
