import axios           from 'axios'
import { boot }        from 'quasar/wrappers'
import { useAuthStore } from 'stores/auth'

// axios instanz
export const api = axios.create({ baseURL: '/api' })


export default boot(() => {
  const auth = useAuthStore()

  api.interceptors.request.use(cfg => {
    const t = auth.getToken()
    if (t) cfg.headers.Authorization = `Bearer ${t}`
    return cfg
  })

  // test
  api.interceptors.request.use(cfg => {
    console.log('%cAXIOS ▶', 'color:orange', cfg.baseURL + cfg.url)
    return cfg
  })
})
