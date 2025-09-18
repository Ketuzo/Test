export default [
  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      { path: '',          name: 'Dashboard',  component: () => import('pages/IndexPage.vue'),       meta: { requiresAuth: true } },
      { path: 'jobs',      name: 'Jobs',       component: () => import('pages/JobsPage.vue'),        meta: { requiresAuth: true } },
      { path: 'workflows', name: 'Workflows',  component: () => import('pages/WorkflowsPage.vue'),   meta: { requiresAuth: true } },
      { path: 'settings',  name: 'Settings',   component: () => import('pages/SettingsPage.vue'),    meta: { requiresAuth: true } },
      { path: 'login',     name: 'Login',      component: () => import('pages/LoginPage.vue') }
    ]
  },

  // 404
  { path: '/:catchAll(.*)*', component: () => import('pages/ErrorNotFound.vue') }
]
