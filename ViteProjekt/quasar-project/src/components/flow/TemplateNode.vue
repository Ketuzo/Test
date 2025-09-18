<template>
  <div class="ffmpeg-node">
    <!-- Kopf -->
    <div class="title row items-center q-gutter-x-xs">
      <span>Template</span>
      <q-badge color="grey-7" dense>Tmpl</q-badge>
      <q-space />
      <q-btn dense flat round icon="close" @click="$emit('remove')" />
    </div>

    <!-- Modus / Stream -->
    <div class="row q-gutter-sm items-center q-mb-sm">
      <q-select
        dense outlined style="width:140px"
        :options="modeOpts"
        v-model="local.mode"
        label="mode"
        @update:model-value="emitPatch"
      />
      <q-badge v-if="local.mode==='cli'" color="orange-6" dense>G</q-badge>

      <template v-else>
        <q-select
          dense outlined style="width:100px"
          :options="streamOpts"
          v-model="local.stream"
          label="stream"
          @update:model-value="emitPatch"
        />
        <q-badge :color="local.stream==='v' ? 'blue-5' : 'purple-5'" dense>
          {{ local.stream.toUpperCase() }}
        </q-badge>
      </template>
    </div>

    <!-- IO (nur Graph) -->
    <div v-if="local.mode==='graph'" class="q-mb-sm">
      <div class="row q-gutter-sm">
        <!-- Eingänge -->
        <q-input
          dense outlined type="number" style="max-width:100px"
          v-model.number.lazy="local.inCount"
          label="inputs"
          :step="1"
          @change="normalizeIO('in')"
          @blur="normalizeIO('in')"
        />
        <!-- Ausgänge -->
        <q-input
          dense outlined type="number" style="max-width:100px"
          v-model.number.lazy="local.outputs"
          label="outputs"
          :step="1"
          @change="normalizeIO('out')"
          @blur="normalizeIO('out')"
        />
      </div>

      <div class="q-mt-sm">
        <div class="text-caption q-mb-xs">output labels</div>
        <div class="column q-gutter-xs">
          <q-input
            v-for="(lbl,i) in local.outLabels" :key="i"
            dense outlined style="max-width:220px"
            v-model="local.outLabels[i]"
            :label="`#${i+1}`"
            @update:model-value="emitPatch"
          />
        </div>
      </div>
    </div>

    <!-- Handles (nur Graph) -->
    <template v-if="local.mode==='graph'">
      <!-- Targets (links) -->
      <Handle
        v-for="i in local.inCount"
        :key="'in-'+i"
        type="target"
        :position="Position.Left"
        :id="`${local.stream}${i-1}`"
        class="vf-handle"
        :data-ch="local.stream.toUpperCase()"
        :style="{ top: `${28 + (i-1)*14}px` }"
      />
      <!-- Sources (rechts) -->
      <Handle
        v-for="i in local.outputs"
        :key="'out-'+i"
        type="source"
        :position="Position.Right"
        :id="`out_${local.stream}${i-1}`"
        class="vf-handle"
        :data-ch="local.stream.toUpperCase()"
        :style="{ top: `${28 + (i-1)*14}px` }"
      />
    </template>

    <!-- Template Text -->
    <q-input
      type="textarea"
      autogrow dense outlined
      v-model="local.template"
      :label="local.mode==='cli' ? 'CLI snippet' : 'Filter snippet'"
      placeholder="Hier dein Go-Template-Snippet eingeben"
      @update:model-value="emitPatch"
    />

    <!-- Beispiele (v-pre, damit keine Auswertung) -->
    <q-item-label caption class="q-mt-xs" v-pre>
      Go-Template + Sprig nutzbar. Beispiele:
      <code>{{ add 1 2 }}</code>,
      <code>{{ default 1920 .Vars.w }}</code>,
      <code>{{ now | date "2006-01-02" }}</code>,
      <code>{{ mul .Vars.bitrate 1000 }}</code>.
    </q-item-label>
  </div>
</template>

<script setup>
import { reactive, watch } from 'vue'
import { Handle, Position } from '@vue-flow/core'

const props = defineProps({
  data: { type: Object, required: true }
})
const emit  = defineEmits(['update:data','remove'])

const modeOpts   = ['graph','cli']
const streamOpts = ['v','a']

// lokale, nicht-mutierende Kopie
const local = reactive({
  mode     : props.data.mode     ?? 'graph',   // 'graph' | 'cli'
  stream   : props.data.stream   ?? 'v',       // 'v' | 'a' (nur graph)
  inCount  : props.data.inCount  ?? 1,
  outputs  : props.data.outputs  ?? 1,
  outLabels: Array.isArray(props.data.outLabels) && props.data.outLabels.length
             ? [...props.data.outLabels] : ['#1'],
  template : props.data.template ?? ''
})

function emitPatch () {
  emit('update:data', { ...local })
}

function clamp(n, lo, hi){
  n = Number.isFinite(n) ? n : lo
  return Math.min(hi, Math.max(lo, Math.trunc(n)))
}

// Korrigiert IO-Werte und synchronisiert outLabels; patcht genau einmal
function normalizeIO(which){
  if (which === 'in') {
    local.inCount = clamp(local.inCount, 1, 4)
  } else {
    local.outputs = clamp(local.outputs, 1, 8)
    while (local.outLabels.length < local.outputs) local.outLabels.push(`#${local.outLabels.length+1}`)
    while (local.outLabels.length > local.outputs) local.outLabels.pop()
  }
  emitPatch()
}

// wenn Parent die Daten austauscht → lokale Kopie behutsam nachziehen
watch(() => props.data, (d) => {
  Object.assign(local, {
    mode     : d.mode     ?? local.mode,
    stream   : d.stream   ?? local.stream,
    inCount  : Number.isFinite(d.inCount)  ? d.inCount  : local.inCount,
    outputs  : Number.isFinite(d.outputs)  ? d.outputs  : local.outputs,
    outLabels: Array.isArray(d.outLabels) && d.outLabels.length ? [...d.outLabels] : local.outLabels,
    template : d.template ?? local.template,
  })
})
</script>

<style scoped>
.ffmpeg-node {
  background:#fffef4;
  border:1px solid #ddd;
  border-radius:6px;
  padding:8px;
  min-width:260px;
  font-size:13px;
  position: relative;
}
.title { font-weight:600; margin-bottom:6px; }

/* Handles + Kanal-Badge */
.vf-handle {
  width:8px; height:8px; background:#555;
  border:2px solid #fff; border-radius:50%;
  position: absolute;
  z-index: 2;
}
.vf-handle[data-ch]::after{
  content: attr(data-ch);
  position: absolute;
  top: -14px;
  left: -4px;
  font-size: 10px;
  font-weight: 700;
  color: #fff;
  background: #607d8b;
  padding: 1px 4px;
  border-radius: 10px;
}
</style>
