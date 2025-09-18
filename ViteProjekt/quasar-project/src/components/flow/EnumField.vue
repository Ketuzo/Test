<template>
  <q-select
    v-model="val"
    :options="opts"
    option-label="label"
    option-value="value"
    dense filled style="max-width:140px"
  >
    <template #selected-item="s">
      <div class="row items-center justify-between full-width">
        <span>{{ s.opt.label }}</span>
        <q-icon name="info" size="14px"><q-tooltip>{{ s.opt.desc }}</q-tooltip></q-icon>
      </div>
    </template>

    <template #option="s">
      <q-item v-bind="s.itemProps">
        <q-item-section>
          <div class="row items-center justify-between">
            <span>{{ s.opt.label }}</span>
            <q-icon name="info" size="14px"><q-tooltip>{{ s.opt.desc }}</q-tooltip></q-icon>
          </div>
        </q-item-section>
      </q-item>
    </template>
  </q-select>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  option: Object,
  modelValue: String
})
const emit = defineEmits(['update:modelValue'])
//getter und setter für befehl
const val = computed({
  get: () => props.modelValue,
  set: v  => emit('update:modelValue', v)
})

//select optionen
const opts = computed(() =>
  props.option.values.map(v => ({
    label: v.name,
    value: v.name,
    desc : v.description.replace(/^[-\d]+\s+\.{2}[A-Z.]+\s+/, '').trim()
  }))
)
</script>
