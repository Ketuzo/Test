import { route } from 'quasar/wrappers'
import { createRouter, createWebHistory } from 'vue-router'
import routes from './routes'
import { useAuthStore } from 'stores/auth'

export default route(() => {
  const Router = createRouter({
    history: createWebHistory(),
    routes
  })

  Router.beforeEach((to, _from, next) => {
    const auth = useAuthStore()
    if (import.meta.env.VITE_AUTH_BYPASS === 'true') {
        return next()
    }

    if (to.meta.requiresAuth && !auth.isLogged) next('/login')
    else next()
  })

  return Router
})
