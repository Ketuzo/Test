import { createApp } from 'vue'
import { Quasar } from 'quasar'
import quasarOpts from './quasar-user-options'

import router from './router'
import App from './App.vue'

createApp(App)
  .use(Quasar, quasarOpts)
  .use(router)
  .mount('#q-app')
