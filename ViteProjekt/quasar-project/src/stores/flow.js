import { defineStore } from 'pinia'

export const useFlowStore = defineStore('flow', {
  state: () => ({
    inspectorNodeId: null   // string | null
  }),
  actions: {
    openInspector (id) { this.inspectorNodeId = id },
    closeInspector ()  { this.inspectorNodeId = null }
  }
})
