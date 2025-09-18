<template>
  <q-page padding>
    <q-table
      :rows="jobs"
      :columns="cols"
      row-key="_id"
      :loading="loading"
      flat bordered
      no-data-label="Noch keine Jobs"
    />
  </q-page>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { storeToRefs }  from 'pinia'
import { useJobsStore } from 'stores/jobs'

const store          = useJobsStore()
const { list: jobs } = storeToRefs(store)
const loading        = ref(false)

const cols = [
  { name:'_id',            label:'ID',      field:'_id',            sortable:true, align:'left' },
  { name:'job_status',     label:'Status',  field:'job_status',     sortable:true },
  { name:'input_file_name',label:'Input',   field:'input_file_name',sortable:true },
  { name:'workflow_name',  label:'Workflow',field:'workflow_name',  sortable:true }
]

onMounted(async () => {
  loading.value = true
  try   { await store.load({ limit: 10 }) }
  finally { loading.value = false }
  store.startSSE()
})

onUnmounted(() => store.stopSSE())
</script>
