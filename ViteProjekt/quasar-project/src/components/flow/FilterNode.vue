<template>
  <div class="ffmpeg-node" :class="catClass">
    <div class="title row items-center q-gutter-x-xs">
      <span class="name ellipsis">{{ data.group || data.key || 'Filter' }}</span>
      <q-badge dense>{{ badge }}</q-badge>

      <q-chip dense square class="chip-io">{{ ioSig }}</q-chip>

      <q-chip v-if="flagsText" dense square outline class="chip-flag mono">
        {{ flagsText }}
        <q-tooltip>
          Filter Flags:<br>
          <b>T</b> timeline/enable,&nbsp;<b>S</b> slice-threaded,&nbsp;<b>C</b> commands
        </q-tooltip>
      </q-chip>

      <q-space />
      <q-btn dense flat round size="sm" icon="close" @click.stop="$emit('remove', id)" />
    </div>

    <q-item-label caption class="q-mb-xs ellipsis-2-lines">
      {{ data.filterDesc || data.description || '' }}
    </q-item-label>

    <!-- Output-Labels -->
    <div v-if="outCount > 0" class="q-mb-sm">
      <div class="row items-center q-gutter-x-sm">
        <span class="mini-label">Output label</span>
        <q-icon name="help_outline" size="16px">
          <q-tooltip>
            Name des/der Ausgänge(s). Im Command als <code>[label]</code> (für Folgeschritte oder
            <code>-map</code>). Leer → Auto (z.B. <code>[{{ id }}_{{ portType }}0]</code>).
          </q-tooltip>
        </q-icon>
      </div>
      <div class="row q-col-gutter-sm q-mt-xs">
        <div v-for="i in outCount" :key="i" class="col">
          <q-input dense filled :label="`#${i}`" v-model="outLabels[i-1]" @keyup.stop
                   :placeholder="`${id}_${portType}${i-1}`" />
        </div>
      </div>
    </div>

    <!-- enable= (T) -->
    <q-input
      v-if="supportsTimeline"
      dense filled class="q-mb-sm"
      label="enable= (FFmpeg-Expr)"
      hint="z.B. between(t,2.4,10) / between(n,100,200)"
      v-model="enableExpr"
      @keyup.stop
    />

    <!-- sendcmd (C) -->
    <div v-if="supportsCommands" class="q-mb-sm">
      <div class="row q-col-gutter-sm">
        <div class="col-4">
          <q-input dense filled label="instance (@name)" v-model="instName" @keyup.stop />
        </div>
        <div class="col">
          <q-input dense filled type="textarea" autogrow
                   label="sendcmd commands (c=…)"
                   hint="Beispiel: 2.4 {{ (data.group||'filter') }}@inst enable 1; 5.0 … enable 0"
                   v-model="sendcmdText" />
        </div>
      </div>
    </div>

    <!-- Option hinzufügen -->
    <q-select
      v-if="unused.length"
      v-model="toAdd"
      :options="unused.map(o => o.option)"
      dense outlined
      label="+ add option"
      @update:model-value="addOption"
      popup-content-style="min-width:240px"
    />

    <!-- Ausgewählte Optionen -->
    <div v-for="(sel, idx) in selected" :key="sel.option" class="opt-row row items-center q-gutter-x-sm q-mt-xs">
      <q-btn size="xs" flat round icon="close" @click="remove(idx)" />
      <strong class="mono">{{ sel.option }}</strong>

      <!-- ENUM: Dropdown + freie Eingabe -->
      <q-select
        v-if="isEnum(sel)"
        v-model="sel.value"
        :options="enumOptions(sel)"
        dense filled
        use-input fill-input hide-selected
        new-value-mode="add-unique"
        @new-value="(v, done) => { sel.value = String(v); done(v, 'add-unique') }"
        @keyup.stop
        style="min-width:180px"
      />

      <!-- Nicht-ENUM: Freitext -->
      <q-input
        v-else
        v-model="sel.value"
        dense filled
        style="min-width:180px"
        @keyup.stop
        placeholder="value / expr"
      />

      <q-item-label caption class="col-grow ellipsis">{{ sel.cleanDesc }}</q-item-label>
    </div>

    <!-- ▼ Go Template (optional) -->
    <q-expansion-item dense icon="code" label="Go Template (optional)" class="q-mt-sm">
      <div class="row q-col-gutter-sm q-mt-xs">
        <div class="col-4">
          <q-select
            v-model="tplMode"
            :options="TPL_MODES"
            dense filled
            label="Template-Mode"
            emit-value map-options
          />
        </div>
        <div class="col">
          <q-input
            v-model="tplText"
            type="textarea" autogrow
            dense filled
            :disable="tplMode==='off'"
            :placeholder="tplPlaceholder"
          />
          <!-- Beispiel-Block NICHT parsen lassen -->
          <pre v-pre class="mono q-mt-xs">
# Append to params → erzeugt 'k=v[:k2=v2]'
{{- if eq .Vars.Profile "uhd" -}}w=3840:h=2160{{- end -}}

# Replace filter body → kompletter Body:
scale='if(gt(a,16/9),1920,-1)':'if(gt(a,16/9),-1,1080)'
          </pre>
        </div>
      </div>
    </q-expansion-item>

    <!-- Handles -->
    <template v-for="(pt, i) in inPorts" :key="'in'+i">
      <Handle type="target" :id="pt + i" :position="Position.Left" class="port"
              :style="{ top: `${PORT_BASE + i*PORT_STEP}px` }" />
      <span class="p-label left" :style="{ top: `${PORT_BASE + i*PORT_STEP}px` }">{{ pt }}{{ i }}</span>
    </template>

    <template v-for="(pt, i) in outPorts" :key="'out'+i">
      <Handle type="source" :id="'out_' + pt + i" :position="Position.Right" class="port"
              :style="{ top: `${PORT_BASE + i*PORT_STEP}px` }" />
      <span class="p-label right" :style="{ top: `${PORT_BASE + i*PORT_STEP}px` }">{{ pt }}{{ i }}</span>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import { getRawFlags } from 'src/utils/flags'

const props = defineProps({ id: String, data: Object })
const emit  = defineEmits(['update:data', 'remove'])

/* -------- Meta zu Typ/Kategorie ---------- */
const portType = computed(() => {
  const c = props.data?.cat
  if (c === 'audio-filter') return 'a'
  if (c === 'global' || c === 'other') return 'g'
  return 'v'
})
const badge    = computed(() => portType.value.toUpperCase())
const catClass = computed(() => `cat-${props.data?.cat || 'generic'}`)

const inPorts  = computed(() => props.data?.inputs  || [portType.value])
const outCount = computed(() => Number(props.data?.outputs ?? 1))
const outPorts = computed(() => Array.from({ length: outCount.value }, () => portType.value))

const ioSig = computed(() => {
  const i = `${badge.value}×${inPorts.value.length}`
  const o = `${badge.value}${outCount.value > 1 ? `×${outCount.value}` : ''}`
  return `${i}→${o}`
})

/* -------- Flags: T / S / C ---------- */
const rawFlags  = computed(() => getRawFlags(props.data) || '')
const flagsText = computed(() => rawFlags.value || '')
const supportsTimeline = computed(() => /t/i.test(rawFlags.value)) // enable=
const supportsCommands = computed(() => /c/i.test(rawFlags.value)) // sendcmd

/* -------- Output-Labels ---------- */
const outLabels = ref(Array.from({ length: outCount.value }, (_, i) => props.data?.outLabels?.[i] || ''))
watch(outCount, (n) => {
  outLabels.value = Array.from({ length: n }, (_, i) => outLabels.value[i] || '')
})
watch(outLabels, () => {
  emit('update:data', { ...props.data, outLabels: outLabels.value })
}, { deep: true })

/* -------- T/C-Felder ---------- */
const enableExpr  = ref(props.data?.enable   || '')
const instName    = ref(props.data?.instance || '')
const sendcmdText = ref(props.data?.sendcmd  || '')

/* -------- Optionen ---------- */
const selected = ref([])
const toAdd    = ref(null)
const unused = computed(() =>
  (props.data?.options || []).filter(o => !selected.value.some(s => s.option === o.option))
)
const stripDesc = txt => (txt || '').replace(/^[-\d]+\s+\.{2}[A-Z.]+\s+/, '').trim()

function enumOptions (sel) {
  return (sel.values || []).map(v => (v && typeof v === 'object')
    ? (v.name ?? v.label ?? String(v.value ?? ''))
    : String(v))
}

function addOption (name) {
  const o = (props.data?.options || []).find(x => x.option === name)
  if (!o) return
  selected.value.push({
    ...o,
    cleanDesc: stripDesc(o.description),
    value: (o.default ?? '')
  })
  toAdd.value = null
}
function remove (idx) { selected.value.splice(idx, 1) }
const isEnum = o => Array.isArray(o.values) && o.values.length > 0

/* -------- Go-Template (pro Node) ---------- */
const TPL_MODES = [
  { label: 'Off', value: 'off' },
  { label: 'Append to params', value: 'append' },
  { label: 'Replace filter body', value: 'replace' }
]
const tplMode = ref(props.data?.tplMode || 'off')
const tplText = ref(props.data?.tplText || '')

const tplPlaceholder = `Go-Template hier eingeben… (Sprig erlaubt)
# z.B.:
{{- if eq .Vars.Profile "uhd" -}}w=3840:h=2160{{- end -}}`;

/* -------- Emit zusammenführen ---------- */
watch([selected, enableExpr, instName, sendcmdText, outLabels, tplMode, tplText], () => {
  const params = selected.value
    .map(s => ({ k: s.option, v: s.value }))
    .filter(p => p.v != null && String(p.v).trim() !== '')

  emit('update:data', {
    ...props.data,
    params,
    enable  : enableExpr.value,
    instance: instName.value,
    sendcmd : sendcmdText.value,
    outLabels: outLabels.value,
    tplMode : tplMode.value,
    tplText : tplText.value
  })
}, { deep: true })

/* -------- Ports ---------- */
const PORT_BASE = 64
const PORT_STEP = 18
</script>

<style scoped>
.ffmpeg-node { position:relative;background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:10px;min-width:320px;max-width:560px;font-size:13px; }
.title { font-weight:600; margin-bottom:4px; }
.name { max-width: 40%; }

.chip-io   { background:#eef2ff; color:#3730a3; }
.chip-flag { border-color:#9ca3af; color:#374151; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, "Liberation Mono", "Courier New", monospace; }

.mini-label { font-size:12px; opacity:.8; }
.opt-row strong { font-weight:600; }

.port :deep(.vue-flow__handle){ width:12px;height:12px;border:2px solid #9ca3af;background:#fff; }
.p-label{ position:absolute; transform:translateY(-7px); font-size:12px; opacity:.7; pointer-events:none; }
.p-label.left{ left:-2px; } .p-label.right{ right:-2px; }

.cat-video-filter{ background:#fffbea; }
.cat-audio-filter{ background:#f5f0ff; }
.cat-global{ background:#f8fafc; }
</style>
