<template>
  <div class="smart-field">
    <component
      :is="useSelect ? 'q-select' : 'q-input'"
      v-model="innerValue"
      :options="useSelect ? options : undefined"
      :use-input="useSelect"
      :map-options="useSelect"
      :emit-value="useSelect"
      :fill-input="useSelect"
      :clearable="true"
      dense
      outlined
      :type="(!useSelect && (multiline || isTemplate)) ? 'textarea' : 'text'"
      :autogrow="(!useSelect && (multiline || isTemplate))"
      :label="label"
      @dragover.prevent="onDragOver"
      @drop.prevent="onDrop"
    >
      <template #append>
        <q-btn
          dense flat round size="sm"
          :color="isTemplate ? 'primary' : 'grey-7'"
          :icon="isTemplate ? 'data_object' : 'code'"
          @click="toggleTemplate"
        >
          <q-tooltip>{{ isTemplate ? 'Template aktiv' : 'Als Template bearbeiten' }}</q-tooltip>
        </q-btn>
        <q-btn dense flat round size="sm" icon="bolt" @click="openFx = true">
          <q-tooltip>Sprig / Presets</q-tooltip>
        </q-btn>
      </template>
      <template #hint>
        <span v-if="isTemplate && braceErr" class="text-negative">Unbalancierte {{ }}-Klammern</span>
        <span v-else-if="hint">{{ hint }}</span>
      </template>
    </component>

    <q-dialog v-model="openFx" persistent maximized>
      <q-card class="q-pa-md">
        <div class="row items-center q-gutter-sm q-mb-sm">
          <div class="text-h6">{{ label }} – Template</div>
          <q-space /><q-btn flat dense icon="close" @click="openFx = false" />
        </div>

        <q-input v-model="tmplBuffer" type="textarea" autogrow outlined :error="braceErr" />

        <div class="row q-mt-sm items-center q-gutter-sm">
          <q-select v-model="presetSel" :options="presetOptions" label="Preset einfügen" dense outlined style="min-width:280px"/>
          <q-btn label="Preset einfügen" @click="insertPreset"/>
          <q-space /><q-btn color="primary" label="Übernehmen" @click="applyTemplate"/>
        </div>

        <q-separator class="q-my-md" />
        <div class="text-subtitle2 q-mb-xs">Sprig Beispiele (klick zum Einfügen)</div>
        <div class="row q-col-gutter-sm">
          <q-chip v-for="fn in sprigQuick" :key="fn" clickable @click="append(fn)">{{ fn }}</q-chip>
        </div>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { SPRIG_PRESETS } from 'src/sprig/presets'

const props = defineProps({
  modelValue: { type: [String, Object], default: '' }, // string | { kind:'template', value:string }
  label: { type: String, default: '' },
  options: { type: Array, default: () => [] },
  multiline: { type: Boolean, default: false },
  hint: { type: String, default: '' }
})
const emit = defineEmits(['update:modelValue'])

const isTemplate = ref(false)
const displayValue = ref('')

watch(
  () => props.modelValue,
  (mv) => {
    if (mv && typeof mv === 'object' && mv.kind === 'template') {
      isTemplate.value = true
      displayValue.value = mv.value || ''
    } else {
      isTemplate.value = false
      displayValue.value = typeof mv === 'string' ? mv : ''
    }
  },
  { immediate: true }
)

const useSelect = computed(() =>
  Array.isArray(props.options) && props.options.length > 0 && !isTemplate.value
)

const innerValue = computed({
  get: () => displayValue.value,
  set: (v) => {
    displayValue.value = v ?? ''
    if (isTemplate.value) emit('update:modelValue', { kind: 'template', value: displayValue.value })
    else emit('update:modelValue', displayValue.value)
  }
})

function toggleTemplate () {
  isTemplate.value = !isTemplate.value
  innerValue.value = displayValue.value
}

const braceErr = computed(() => {
  if (!isTemplate.value) return false
  const s = displayValue.value || ''
  return (s.match(/{{/g) || []).length !== (s.match(/}}/g) || []).length
})

const openFx = ref(false)
const tmplBuffer = ref('')
const presetSel = ref(null)
const presetOptions = SPRIG_PRESETS.map(p => ({ label: p.name, value: p.id }))
const sprigQuick = [
  '{{ default "mp4" .Vars.ext }}',
  '{{ now | date "2006-01-02" }}',
  '{{ coalesce .Vars.a .Vars.b }}'
]

function applyTemplate () {
  isTemplate.value = true
  innerValue.value = tmplBuffer.value
  openFx.value = false
}
function insertPreset () {
  if (!presetSel.value) return
  const p = SPRIG_PRESETS.find(x => x.id === presetSel.value)
  if (p) tmplBuffer.value = (tmplBuffer.value ? tmplBuffer.value + '\n' : '') + p.body
}
function append (txt) {
  tmplBuffer.value = (tmplBuffer.value ? tmplBuffer.value + '\n' : '') + txt
}

function onDragOver (e) {
  const types = e.dataTransfer?.types || []
  if ([...types].includes('application/json')) e.dataTransfer.dropEffect = 'copy'
}
function onDrop (e) {
  const txt = e.dataTransfer?.getData('application/json')
  if (!txt) return
  try {
    const payload = JSON.parse(txt)
    if (payload?.template) {
      tmplBuffer.value = (tmplBuffer.value ? tmplBuffer.value + '\n' : '') + payload.template
      openFx.value = true
    }
  } catch (_err) { void _err }
}
</script>

<style scoped>
.smart-field { width: 100%; }
</style>
