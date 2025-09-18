<!-- src/components/flow/CommandPalette.vue -->
<template>
  <!-- Suche (nur FFmpeg-Optionen durchsuchen) -->
  <q-input
    v-model="query"
    dense
    filled
    square
    placeholder="Search ffmpeg options…"
    class="q-mb-sm"
    @keydown.stop
  >
    <template #prepend><q-icon name="search" /></template>
  </q-input>

  <!-- Go Template Blocks (nur die von FlowComp unterstützten) -->
  <q-expansion-item
    icon="widgets"
    label="Go Template Blocks"
    expand-separator
    class="q-my-xs"
    default-opened
  >
    <q-list dense bordered>
      <!-- If / Else -->
      <q-item clickable tag="div" draggable="true"
              @dragstart="dragJson($event, { kind:'tpl-if' })">
        <q-item-section avatar><q-icon name="splitscreen" /></q-item-section>
        <q-item-section>If / Else</q-item-section>
        <q-item-section side><q-badge outline>cond</q-badge></q-item-section>
      </q-item>

      <!-- Declare Variable -->
      <q-item clickable tag="div" draggable="true"
              @dragstart="dragJson($event, { kind:'tpl-var' })">
        <q-item-section avatar><q-icon name="code" /></q-item-section>
        <q-item-section>Declare Variable</q-item-section>
        <q-item-section side><q-badge outline>g</q-badge></q-item-section>
      </q-item>

      <!-- Range (for-loop) -->
      <q-item clickable tag="div" draggable="true"
              @dragstart="dragJson($event, { kind:'tpl-range' })">
        <q-item-section avatar><q-icon name="sync" /></q-item-section>
        <q-item-section>Range (for-loop)</q-item-section>
        <q-item-section side><q-badge outline>loop</q-badge></q-item-section>
      </q-item>

      <!-- Filter Chain Container -->
      <q-item clickable tag="div" draggable="true"
              @dragstart="dragJson($event, { kind:'tpl-filterchain' })">
        <q-item-section avatar><q-icon name="tune" /></q-item-section>
        <q-item-section>Filter Chain</q-item-section>
        <q-item-section side><q-badge outline>filters</q-badge></q-item-section>
      </q-item>

      <!-- Output Sammelziel -->
      <q-item clickable tag="div" draggable="true"
              @dragstart="dragJson($event, { kind:'tpl-output' })">
        <q-item-section avatar><q-icon name="outbox" /></q-item-section>
        <q-item-section>Output</q-item-section>
        <q-item-section side><q-badge outline>sink</q-badge></q-item-section>
      </q-item>
    </q-list>
  </q-expansion-item>

  <!-- FFmpeg Optionen -->
  <q-expansion-item
    v-for="(groups, cat) in grouped"
    :key="cat"
    :label="catLabels[cat] || cat"
    expand-separator
    class="q-my-xs"
  >
    <q-expansion-item
      v-for="(opts, gname) in groups"
      :key="gname"
      dense
      class="q-ml-sm q-my-xs"
    >
      <template #header>
        <div class="row items-center q-gutter-x-xs"
             draggable="true"
             @dragstart="onDragGroup($event, gname, opts, cat)">
          <span class="text-weight-medium">{{ gname }}</span>

          <q-badge v-if="opts[0].filter_io" color="grey-8" style="font-size:10px">
            {{ opts[0].filter_io }}
          </q-badge>

          <q-icon v-if="showInfoIcon(cat)" name="info" size="16px" class="cursor-pointer">
            <q-tooltip>
              {{ opts[0].filter_description || opts[0].description || '—' }}
            </q-tooltip>
          </q-icon>

          <q-space />
        </div>
      </template>

      <q-list dense bordered>
        <q-item
          v-for="opt in opts"
          :key="opt.option || opt.name"
          tag="div"
          draggable="true"
          @dragstart="onDragOption($event,opt)"
          class="q-px-sm cursor-pointer"
        >
          <q-item-section>
            <strong>{{ opt.option || opt.name }}</strong>
            <q-item-label caption>{{ opt.description }}</q-item-label>
          </q-item-section>
        </q-item>
      </q-list>
    </q-expansion-item>
  </q-expansion-item>

  <!-- Sprig Functions -->
  <q-expansion-item
    icon="bolt"
    label="Sprig Functions"
    expand-separator
    class="q-my-xs"
  >
    <q-expansion-item
      v-for="(items, groupName) in SPRIG_GROUPS"
      :key="groupName"
      dense
      class="q-ml-sm q-my-xs"
    >
      <template #header>
        <div class="row items-center q-gutter-x-sm">
          <q-icon name="snippet_folder" size="16px" />
          <span class="text-weight-medium">Sprig: {{ groupName }}</span>
        </div>
      </template>

      <q-list dense bordered>
        <q-item
          v-for="fn in items"
          :key="fn.name"
          tag="div"
          class="q-px-sm cursor-pointer"
          draggable="true"
          @dragstart="onDragSprig($event, fn)"
        >
          <q-item-section>
            <div class="row items-center justify-between">
              <strong>{{ fn.name }}</strong>
              <q-badge outline>{{ fn.sig }}</q-badge>
            </div>
            <q-item-label caption>{{ fn.desc }}</q-item-label>
          </q-item-section>
        </q-item>
      </q-list>
    </q-expansion-item>
  </q-expansion-item>

  <!-- Presets -->
  <q-expansion-item
    icon="playlist_add"
    label="Transcode & BMX Presets"
    expand-separator
    class="q-my-xs"
  >
    <div class="row items-center q-gutter-sm q-mb-sm">
      <q-input v-model="presetFilter" dense outlined clearable placeholder="Presets filtern…" class="col" />
      <q-badge v-if="filteredPresets.length !== SPRIG_PRESETS.length" color="primary" outline>
        {{ filteredPresets.length }}/{{ SPRIG_PRESETS.length }}
      </q-badge>
    </div>

    <q-list dense bordered>
      <q-item
        v-for="p in filteredPresets"
        :key="p.id"
        tag="div"
        class="q-px-sm cursor-pointer"
        draggable="true"
        @dragstart="onDragPreset($event, p)"
      >
        <q-item-section>
          <div class="row items-center justify-between">
            <strong>{{ p.name }}</strong>
            <q-badge outline>{{ p.engine || 'ffmpeg' }}</q-badge>
          </div>
          <q-item-label caption>
            <span v-if="p.tags && p.tags.length">{{ p.tags.join(' • ') }}</span>
          </q-item-label>
        </q-item-section>
      </q-item>
    </q-list>
  </q-expansion-item>

  <!-- (optional) BMX -->
  <q-expansion-item
    v-if="bmx.list.length"
    icon="precision_manufacturing"
    label="BMX Options"
    expand-separator
    class="q-my-xs"
  >
    <q-expansion-item
      v-for="(opts, gname) in bmxGrouped"
      :key="gname"
      dense
      class="q-ml-sm q-my-xs"
    >
      <template #header>
        <div class="row items-center q-gutter-x-xs"
             draggable="true"
             @dragstart="onDragGroup($event, gname, opts, 'bmx')">
          <span class="text-weight-medium">{{ gname }}</span>
          <q-space />
        </div>
      </template>

      <q-list dense bordered>
        <q-item
          v-for="opt in opts"
          :key="opt.option || opt.name"
          tag="div"
          draggable="true"
          @dragstart="onDragOption($event,opt)"
          class="q-px-sm cursor-pointer"
        >
          <q-item-section>
            <strong>{{ opt.name || opt.option }}</strong>
            <q-item-label caption>{{ opt.description }}</q-item-label>
          </q-item-section>
        </q-item>
      </q-list>
    </q-expansion-item>
  </q-expansion-item>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import Fuse from 'fuse.js'
import { useFfmpegOptions } from 'src/stores/useFfmpegOptions'
import { useBmxOptions } from 'src/stores/useBmxOptions'
import { categorizeOption } from 'src/utils/categorize'
import { SPRIG_GROUPS } from 'src/sprig/functions'
import { SPRIG_PRESETS } from 'src/sprig/presets'

/* Stores laden */
const ff  = useFfmpegOptions()
const bmx = useBmxOptions()

/* Suche */
const query = ref('')
const fuse  = ref(null)
const list  = ref([])

onMounted(async () => {
  await Promise.all([
    ff.load(),
    bmx.load().catch(() => {})
  ])
  fuse.value = new Fuse(ff.list, {
    keys: ['group','option','description'],
    threshold: 0.3
  })
  list.value = ff.list
})

watch(query, q => {
  list.value = q ? fuse.value.search(q).map(r => r.item) : ff.list
})

/* FFmpeg gruppieren */
const grouped = computed(() => {
  const t = {}
  list.value.forEach(o => {
    const { cat, group } = categorizeOption(o)   // 'global','other','audio-filter','video-filter'
    const perCat = (t[cat] ||= {})
    const arr    = (perCat[group] ||= [])
    if (!arr.some(x => (x.option || x.name) === (o.option || o.name))) arr.push(o)
  })
  return t
})

/* BMX gruppieren */
const bmxGrouped = computed(() => {
  const t = {}
  ;(bmx.list || []).forEach(o => {
    (t[o.group || 'BMX'] ||= []).push(o)
  })
  return t
})

/* Labels + UI Helfer */
function showInfoIcon (cat) {
  return cat === 'video-filter' || cat === 'audio-filter'
}
const catLabels = {
  global: 'Global Options',
  other: 'Misc',
  'video-filter': 'Video Filters',
  'audio-filter': 'Audio Filters'
}

/* ---------- Drag helpers ---------- */
function dragJson (e, obj) {
  const s = JSON.stringify(obj)
  e.dataTransfer.effectAllowed = 'copy'
  // Primär
  e.dataTransfer.setData('application/json', s)
  // Fallback (manche Browser/Wrapper propagieren nur text/plain)
  e.dataTransfer.setData('text/plain', s)
}

/** Gruppen-Drag: type:'filter-group' (kompatibel zum FilterChain-Drop) */
function onDragGroup (e, gname, opts, cat) {
  dragJson(e, { type:'filter-group', group:gname, cat, options:opts })
}

/** Einzelne Option: rohes Objekt – FilterChain/Canvas erkennt .option/.name */
function onDragOption (e, opt) {
  dragJson(e, opt)
}

/** Sprig-Funktion: als Snippet-Template dropbar */
function onDragSprig (e, fn) {
  dragJson(e, {
    type: 'sprig-fn',
    title: `sprig:${fn.name}`,
    template: fn.snippet
  })
}

/** Preset: als Snippet-Template dropbar */
function onDragPreset (e, p) {
  dragJson(e, {
    type: 'sprig-preset',
    title: p.name,
    template: p.body
  })
}

/* ---------- Preset-Filter ---------- */
const presetFilter = ref('')
const filteredPresets = computed(() => {
  const q = presetFilter.value?.toLowerCase() || ''
  if (!q) return SPRIG_PRESETS
  return SPRIG_PRESETS.filter(p =>
    [p.name, p.engine, ...(p.tags || [])]
      .join(' ')
      .toLowerCase()
      .includes(q)
  )
})
</script>

<style scoped>
.q-expansion-item__container {
  border: 1px solid #ccc;
  border-radius: 4px;
}
</style>
