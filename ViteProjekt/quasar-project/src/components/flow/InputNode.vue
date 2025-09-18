<template>
  <div class="input-node">
    <div class="row items-center q-gutter-x-xs title">
      <q-icon name="movie" size="18px" />
      <div class="text-weight-medium">Input #{{ data.index ?? 0 }}</div>
      <q-space />
      <q-btn dense flat round size="sm" icon="delete" @click.stop="$emit('remove', id)" />
    </div>

    <q-input
      dense filled
      label="Pfad / URL"
      v-model="pathLocal"
      @update:model-value="sync()"
      placeholder="./input.mp4"
      class="q-mb-sm"
    />

    <div class="row q-col-gutter-sm">
      <div class="col-5">
        <q-input
          dense filled type="number"
          label="Index"
          v-model.number="indexLocal"
          @update:model-value="sync()"
          hint="entspricht 0:, 1:, 2: …"
        />
      </div>
      <div class="col">
        <q-item-label caption>
          Dieser Node liefert zwei Ausgänge:
          <span class="mono">[{{ indexLocal }}:v]</span> und
          <span class="mono">[{{ indexLocal }}:a]</span>
        </q-item-label>
      </div>
    </div>

    <!-- OUTPUT ports -->
    <Handle type="source" id="out_v0" :position="Position.Right" class="port" :style="{ top: '64px' }" />
    <span class="p-label right" style="top: 64px">v0</span>

    <Handle type="source" id="out_a0" :position="Position.Right" class="port" :style="{ top: '82px' }" />
    <span class="p-label right" style="top: 82px">a0</span>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { Handle, Position } from '@vue-flow/core'

const props = defineProps({ id: String, data: Object })
const emit  = defineEmits(['update:data', 'remove'])

const pathLocal  = ref(props.data?.path  ?? './input.mp4')
const indexLocal = ref(Number(props.data?.index ?? 0))

function sync () {
  emit('update:data', { ...props.data, path: pathLocal.value, index: indexLocal.value })
}
</script>

<style scoped>
.input-node {
  position: relative;
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 10px;
  min-width: 260px;
  font-size: 13px;
}
.title { margin-bottom: 6px; }

.port :deep(.vue-flow__handle){ width:12px;height:12px;border:2px solid #94a3b8;background:#fff; }
.p-label{ position:absolute; transform:translateY(-7px); font-size:12px; opacity:.7; pointer-events:none; }
.p-label.right{ right:-2px; }

.mono{ font-family: ui-monospace, Menlo, Monaco, Consolas, "Courier New", monospace; }
</style>
