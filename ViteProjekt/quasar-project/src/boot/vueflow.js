import { boot }    from 'quasar/wrappers'
import { VueFlow } from '@vue-flow/core'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'

export default boot(({ app }) => {
  app.component('VueFlow', VueFlow)
})
