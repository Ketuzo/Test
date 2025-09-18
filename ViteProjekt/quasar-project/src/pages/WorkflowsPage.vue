<template>
  <q-page class="column fit">
    <!-- AppBar -->
    <div class="row items-center q-pa-sm bg-primary text-white">
      <div class="text-h6 q-mr-md">Workflows</div>

      <!-- INPUT+ bleibt -->
      <q-btn color="white" text-color="primary" icon="add" label="INPUT +" dense class="q-mr-sm"
             @click="addInput" />

      <!-- Template+ ENTFERNT -->

      <q-space />

      <!-- EXPORT bleibt stets sichtbar -->
      <q-btn color="secondary" icon="ios_share" label="EXPORT" @click="doExport" />
    </div>

    <div class="row fit">
      <!-- Palette links -->
      <div class="col-3 q-pa-sm scroll">
        <CommandPalette />
      </div>

      <!-- Flow Mitte -->
      <div class="col q-pa-none">
        <FlowComp ref="flowRef" class="fit" />
      </div>
    </div>

    <!-- FFmpeg Vorschau -->
    <div class="bg-dark text-white q-pa-sm mono" style="font-size:13px;">
      {{ ffmpegText }}
    </div>
  </q-page>
</template>

<script setup>
import { ref } from 'vue'
import CommandPalette from 'src/components/flow/CommandPalette.vue'
import FlowComp from 'src/components/flow/FlowComp.vue'
import buildFFmpegCommandAsync from 'src/lib/exporter-async'

const flowRef = ref(null)
const ffmpegText = ref('echo "no graph"')

function addInput () {
  flowRef.value?.addInput?.()
}

async function doExport () {
  const state = flowRef.value?.getState?.() || { nodes: [], edges: [] }
  const { cmd } = await buildFFmpegCommandAsync(state)
  ffmpegText.value = cmd
}
</script>

<style scoped>
.mono{ font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, "Liberation Mono", "Courier New", monospace; }
</style>
