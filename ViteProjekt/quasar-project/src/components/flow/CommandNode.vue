<!-- src/components/flow/CommandNode.vue -->
<template>
  <div class="cmd-node" :class="catClass">
    <div class="title row items-center q-gutter-x-xs">
      <span>{{ data.option || data.key }}</span>
      <q-badge v-if="isG" color="grey-7" dense>G</q-badge>
      <q-space />

      <!-- Menü: Node-Template überschreiben -->
      <q-btn dense flat round size="sm" icon="more_vert">
        <q-menu>
          <q-list dense>
            <q-item clickable v-close-popup @click="nodeTplOpen = true">
              <q-item-section>Node-Template überschreiben…</q-item-section>
            </q-item>
          </q-list>
        </q-menu>
      </q-btn>

      <q-btn dense flat round size="sm" icon="close" @click.stop="$emit('remove', id)" />
    </div>

    <q-item-label caption>{{ data.description }}</q-item-label>

    <!-- Wert + Feld-Menü (unverändert) -->
    <div v-if="hasValue" class="q-mt-xs row items-center q-gutter-x-sm">
      <div class="col">
        <SmartField v-model="model.value" :label="data.option || data.key" />
      </div>

      <q-btn dense flat round size="sm" icon="more_vert">
        <q-menu>
          <q-list dense style="min-width:260px">
            <q-item clickable v-close-popup @click="editTemplate()">
              <q-item-section>Als Template bearbeiten…</q-item-section>
            </q-item>
            <q-item clickable v-close-popup @click="toTemplate()" :disable="isTemplateVal(model.value)">
              <q-item-section>In Template umwandeln</q-item-section>
            </q-item>
            <q-item clickable v-close-popup @click="toPlain()" :disable="!isTemplateVal(model.value)">
              <q-item-section>Zu normalem Wert zurück</q-item-section>
            </q-item>

            <q-separator />

            <q-item clickable>
              <q-item-section>Preset einfügen</q-item-section>
              <q-item-section side><q-icon name="chevron_right" /></q-item-section>
              <q-menu anchor="top right" self="top left">
                <q-list dense style="max-height:260px;overflow:auto;min-width:360px">
                  <q-item v-for="p in SPRIG_PRESETS" :key="p.id" clickable v-close-popup @click="insertPreset(p)">
                    <q-item-section>{{ p.name }}</q-item-section>
                    <q-item-section side><q-badge outline>{{ p.engine || 'ffmpeg' }}</q-badge></q-item-section>
                  </q-item>
                </q-list>
              </q-menu>
            </q-item>

            <q-item clickable>
              <q-item-section>Sprig-Funktion einfügen</q-item-section>
              <q-item-section side><q-icon name="chevron_right" /></q-item-section>
              <q-menu anchor="top right" self="top left">
                <q-list dense style="max-height:300px;overflow:auto;min-width:360px">
                  <template v-for="(items, g) in SPRIG_GROUPS" :key="g">
                    <q-item-label header class="text-grey-8 q-pt-sm q-pb-xs">{{ g }}</q-item-label>
                    <q-item v-for="fn in items" :key="fn.name" clickable v-close-popup @click="insertSnippet(fn.snippet)">
                      <q-item-section>{{ fn.name }}</q-item-section>
                      <q-item-section side><q-badge outline>{{ fn.sig }}</q-badge></q-item-section>
                    </q-item>
                  </template>
                </q-list>
              </q-menu>
            </q-item>
          </q-list>
        </q-menu>
      </q-btn>
    </div>

    <!-- ▼ Go Template (Flags) – optional -->
    <q-expansion-item dense icon="code" label="Go Template (Flags – optional)" class="q-mt-sm">
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
          <pre v-pre class="mono q-mt-xs">
# Append: zusätzlichen Flag-Text anhängen
{{- if .Vars.Debug -}} -hide_banner -loglevel debug {{- end -}}

# Replace: alle Flags dieses Nodes ersetzen
{{- if eq .Vars.Profile "fast" -}} -preset fast -tune zerolatency {{- end -}}
          </pre>
        </div>
      </div>
    </q-expansion-item>

    <!-- Ports (g) -->
    <div v-if="isG" class="ports left">
      <Handle type="target" id="g0" :position="Position.Left"  :style="{ top: TOP_G }" class="port-g" />
      <span class="lbl l-left"  :style="{ top: TOP_G }">g</span>
    </div>
    <div v-if="isG" class="ports right">
      <Handle type="source" id="out_g0" :position="Position.Right" :style="{ top: TOP_G }" class="port-g" />
      <span class="lbl l-right" :style="{ top: TOP_G }">g</span>
    </div>

    <!-- Dialog: Node-Template Override (vollständiger Ersatz) -->
    <q-dialog v-model="nodeTplOpen" persistent>
      <q-card class="q-pa-md" style="min-width:720px;max-width:95vw">
        <div class="row items-center q-gutter-sm q-mb-sm">
          <div class="text-h6">Node-Template Override</div>
          <q-space /><q-btn flat dense icon="close" v-close-popup />
        </div>
        <SmartField
          v-model="nodeTplObj"
          :multiline="true"
          label="Template für gesamten Node"
          hint="Wenn gesetzt, ersetzt dieser Block die normale Ausgabe des Nodes."
        />
        <div class="row justify-end q-gutter-sm q-mt-md">
          <q-btn flat label="Abbrechen" v-close-popup />
          <q-btn color="primary" label="Übernehmen" @click="saveNodeTpl" />
        </div>
      </q-card>
    </q-dialog>

    <!-- Dialog: Feld-Template -->
    <q-dialog v-model="fieldDialog" persistent>
      <q-card class="q-pa-md" style="min-width:680px;max-width:95vw">
        <div class="row items-center q-gutter-sm q-mb-sm">
          <div class="text-h6">{{ data.option || data.key }} – Template</div>
          <q-space /><q-btn flat dense icon="close" v-close-popup />
        </div>
        <SmartField v-model="model.value" :label="data.option || data.key" :multiline="true" />
        <div class="row justify-end q-gutter-sm q-mt-md">
          <q-btn flat label="Schließen" v-close-popup />
        </div>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup>
import { reactive, computed, watch, ref } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import SmartField from 'src/components/common/SmartField.vue'
import { SPRIG_GROUPS } from 'src/sprig/functions'
import { SPRIG_PRESETS } from 'src/sprig/presets'

const props = defineProps({
  id: String,
  data: { type: Object, default: () => ({}) }
})
const emit = defineEmits(['update:data', 'remove'])

const TOP_G = '66px'
const isG = computed(() => {
  const cat = props.data?.cat || 'global'
  return cat === 'global' || cat === 'other'
})
const catClass = computed(() => (isG.value ? 'cat-global' : ''))
const hasValue = computed(() => typeof props.data?.value !== 'undefined')

/* --- Wert --- */
const model = reactive({ value: props.data?.value })

/* --- Feld-Template-Menü --- */
const fieldDialog = ref(false)
function isTemplateVal (v) { return v && typeof v === 'object' && v.kind === 'template' }
function toTemplate () {
  const cur = isTemplateVal(model.value) ? (model.value.value || '') : (model.value ?? '')
  model.value = { kind: 'template', value: String(cur) }
}
function toPlain () { if (isTemplateVal(model.value)) model.value = model.value.value || '' }
function editTemplate () { toTemplate(); fieldDialog.value = true }
function insertPreset (p) {
  toTemplate()
  const cur = model.value.value || ''
  model.value = { kind:'template', value:(cur ? cur+'\n' : '') + (p.body || '') }
}
function insertSnippet (s) {
  toTemplate()
  const cur = model.value.value || ''
  model.value = { kind:'template', value:(cur ? cur+'\n' : '') + s }
}

/* --- Go-Template (Flags) – Einklapper --- */
const TPL_MODES = [
  { label: 'Off', value: 'off' },
  { label: 'Append flags', value: 'append' },
  { label: 'Replace flags', value: 'replace' }
]
const tplMode = ref(props.data?.tplMode || 'off')
const tplText = ref(props.data?.tplText || '')
const tplPlaceholder = `Go-Template für Flags… (Sprig erlaubt)
# z.B.:
{{- if .Vars.Debug -}} -hide_banner -loglevel debug {{- end -}}`

/* --- Node-Template Override --- */
const nodeTplOpen = ref(false)
const nodeTplObj  = ref(props.data?.templateOverride || '')

/* --- Sync/Emit --- */
watch(
  [model, tplMode, tplText, () => props.data?.templateOverride],
  () => {
    if (props.data?.templateOverride !== undefined && props.data.templateOverride !== nodeTplObj.value) {
      nodeTplObj.value = props.data.templateOverride || ''
    }
    emit('update:data', {
      ...props.data,
      ...model,
      tplMode: tplMode.value,
      tplText: tplText.value
    })
  },
  { deep: true }
)

function saveNodeTpl () {
  emit('update:data', {
    ...props.data,
    ...model,
    templateOverride: nodeTplObj.value,
    tplMode: 'replace',
    tplText: nodeTplObj.value
  })
  nodeTplOpen.value = false
}
</script>

<style scoped>
.cmd-node{ position:relative; background:#fff; border:1px solid #ddd; border-radius:8px; padding:8px; min-width:240px; }
.title{ font-weight:600; margin-bottom:4px; }

.ports{ position:absolute; top:0; width:0; }
.ports.left{ left:-10px; }
.ports.right{ right:-10px; }

.lbl{ position:absolute; transform:translateY(-7px); font-size:12px; opacity:.7; pointer-events:none; }
.lbl.l-left{ left:10px; }
.lbl.l-right{ right:10px; }

.port-g :deep(.vue-flow__handle){ width:12px; height:12px; border:2px solid #9ca3af; background:#fff; }
.cat-global{ background:#f8fafc; }

.mono{ font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
</style>
