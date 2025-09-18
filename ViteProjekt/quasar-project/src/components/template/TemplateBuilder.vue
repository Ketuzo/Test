<template>
  <div class="tpl-builder h-full">

    <!-- 3-pane layout: left palette | center canvas | right optional preview -->
    <div class="tpl-columns">
      <!-- PALETTE (left) -->
      <aside class="tpl-palette">
        <div class="tpl-palette__title">Template-Nodes</div>

        <div
          v-for="it in PALETTE"
          :key="it.type"
          class="tpl-palette__item"
          draggable="true"
          @dragstart="onDragStart($event, it)"
          :title="it.help"
        >
          <q-icon :name="it.icon" size="18px" class="q-mr-sm" />
          <span>{{ it.label }}</span>
        </div>

        <q-separator spaced />

        <q-toggle
          v-model="showPreview"
          label="Vorschau anzeigen"
          dense
          class="q-mt-sm"
        />
      </aside>

      <!-- CANVAS (center) -->
      <section class="tpl-canvas" @drop="onDrop" @dragover.prevent>
        <VueFlow
          v-model:nodes="nodes"
          v-model:edges="edges"
          :node-types="nodeTypes"
          fit-view-on-init
          :zoom-on-scroll="true"
          :min-zoom="0.1"
          :max-zoom="1.5"
          class="tpl-vueflow"
          @connect="onConnect"
        >
          <Controls position="top-left" />
        </VueFlow>
      </section>

      <!-- PREVIEW (right; collapsible) -->
      <aside class="tpl-preview" v-show="showPreview">
        <div class="tpl-preview__head">
          <div class="text-subtitle2">Template Vorschau</div>
          <q-btn dense flat size="sm" icon="content_copy" @click="copyPreview">
            <q-tooltip>Kopieren</q-tooltip>
          </q-btn>
        </div>

        <q-btn-toggle
          v-model="previewTarget"
          toggle-color="primary"
          dense
          spread
          no-caps
          :options="[
            {label: 'als cli', value: 'cli'},
            {label: 'als vf',  value: 'vf'},
            {label: 'als af',  value: 'af'}
          ]"
          class="q-mb-sm"
        />

        <pre class="tpl-preview__code"><code>{{ previewText }}</code></pre>
      </aside>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { VueFlow } from '@vue-flow/core'
import { Controls } from '@vue-flow/controls'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/controls/dist/style.css'

/* node components (stufe-A) */
import TplOutputNode       from './nodes/TplOutputNode.vue'
import TplIfNode           from './nodes/TplIfNode.vue'
import TplRangeNode        from './nodes/TplRangeNode.vue'
import TplFilterChainNode  from './nodes/TplFilterChainNode.vue'
import TplParamsNode       from './nodes/TplParamsNode.vue'
import TplSnippetNode      from './nodes/TplSnippetNode.vue'

import { generateTemplateFromBuilder } from 'src/utils/templateGenerator'

/* ---------------- palette ---------------- */
const PALETTE = [
  { type: 'tpl-output',      icon: 'save',              label: 'Output',            help: 'Sammelpunkte (vf/af/cli)' },
  { type: 'tpl-if',          icon: 'playlist_add_check',label: 'If / Else',         help: 'Bedingter Block; Mehrfach-Else möglich' },
  { type: 'tpl-filterchain', icon: 'tune',              label: 'Filter-Chain',      help: 'scale,bwdif,… als Kette' },
  { type: 'tpl-params',      icon: 'data_object',       label: 'CLI-Flags',         help: '-c:v, -r, -map …' },
  { type: 'tpl-snippet',     icon: 'code',              label: 'Snippet',           help: 'Freitext Go-Template' },
  { type: 'tpl-range',       icon: 'repeat',            label: 'Range',             help: 'Schleife (z.B. Audio-Channels)' },
]

/* ---------------- vue-flow node types ---------------- */
const nodeTypes = {
  'tpl-output'     : TplOutputNode,
  'tpl-if'         : TplIfNode,
  'tpl-range'      : TplRangeNode,
  'tpl-filterchain': TplFilterChainNode,
  'tpl-params'     : TplParamsNode,
  'tpl-snippet'    : TplSnippetNode
}

/* ---------------- state ---------------- */
const nodes = ref([])
const edges = ref([])

const showPreview   = ref(false)
const previewText   = ref('// (leer)')
const previewTarget = ref('cli') // no side effects in computed; updated via watch below

/* ---------------- DnD ---------------- */
function onDragStart (e, item) {
  // IMPORTANT: store the intended template type, not "filter"
  e.dataTransfer.setData('application/vueflow', JSON.stringify({ type: item.type }))
  e.dataTransfer.effectAllowed = 'move'
}

function uid (prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`
}

function defaultDataFor (type) {
  switch (type) {
    case 'tpl-output':
      return { target: 'cli' }               // 'cli'|'vf'|'af'
    case 'tpl-if':
      return {
        // one clause by default; UI component can add more (+)
        clauses: [{ left: 'ScanType', op: 'eq', right: 'Interlaced' }],
        hasElse: true
      }
    case 'tpl-range':
      return { expr: 'until (int (.GetNumberOfAudioChannels))' }
    case 'tpl-filterchain':
      return { chain: [{ name: 'scale', params: { w: '1280', h: '720' } }] }
    case 'tpl-params':
      return { items: [['-c:v', 'mpeg2video'], ['-r', '25']] }
    case 'tpl-snippet':
      return { body: '' }
    default:
      return {}
  }
}

function canvasPoint (evt) {
  // crude positioning near drop point
  const rect = evt.currentTarget.getBoundingClientRect()
  return { x: evt.clientX - rect.left - 120, y: evt.clientY - rect.top - 30 }
}

function onDrop (evt) {
  const raw = evt.dataTransfer.getData('application/vueflow')
  let payload = {}
  try { payload = JSON.parse(raw) } catch { payload = {} }
  const type = payload.type
  if (!type || !nodeTypes[type]) return

  const pos  = canvasPoint(evt)
  nodes.value = [
    ...nodes.value,
    { id: uid(type), type, position: pos, data: defaultDataFor(type) }
  ]
}

function onConnect (params) {
  edges.value = [...edges.value, params]
}

/* ---------------- preview (no side effects in computed) ---------------- */
watch([nodes, edges], () => {
  const { text, target } = generateTemplateFromBuilder({ nodes: nodes.value, edges: edges.value })
  previewText.value   = text || '// (leer)'
  // do not assign previewTarget if user has changed it; just fall back once when empty
  if (!previewTarget.value) previewTarget.value = target || 'cli'
}, { deep: true })

function copyPreview () {
  navigator.clipboard?.writeText(previewText.value)
}
</script>

<style scoped>
.tpl-builder { width: 100%; height: 100%; }

.tpl-columns {
  display: grid;
  grid-template-columns: 240px 1fr 320px; /* palette | canvas | preview */
  gap: 8px;
  height: calc(100vh - 140px); /* leave space for app bars */
  padding: 8px;
}

/* left palette */
.tpl-palette {
  background: #fafafa;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 10px;
  overflow: auto;
}
.tpl-palette__title { font-weight: 600; margin-bottom: 8px; }
.tpl-palette__item {
  display: flex; align-items: center;
  padding: 6px 8px; border: 1px solid #e5e7eb; border-radius: 6px;
  margin-bottom: 6px; cursor: grab; background: #fff;
}
.tpl-palette__item:active { cursor: grabbing; }

/* canvas */
.tpl-canvas {
  border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; background: #fff;
}
.tpl-vueflow { width: 100%; height: 100%; }

/* right preview */
.tpl-preview {
  background: #fafafa; border: 1px solid #e5e7eb; border-radius: 8px;
  padding: 10px; overflow: auto;
}
.tpl-preview__head {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 6px;
}
.tpl-preview__code {
  margin: 0; padding: 8px; background: #111827; color: #e5e7eb;
  border-radius: 6px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, "Courier New", monospace;
  white-space: pre-wrap; word-break: break-word;
}
</style>
