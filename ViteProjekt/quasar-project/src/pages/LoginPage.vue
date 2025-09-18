<template>
  <q-page class="row items-center justify-center">
    <q-card style="min-width:300px">
      <q-card-section class="text-h6">Login</q-card-section>

      <q-card-section>
        <q-input v-model="user"  label="User"      autofocus />
        <q-input v-model="pass"  label="Passwort"  type="password" class="q-mt-sm" />
      </q-card-section>

      <q-card-actions align="right">
        <q-btn color="primary" label="Login" @click="doLogin" />
      </q-card-actions>
    </q-card>
  </q-page>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Notify } from 'quasar'
import { api } from 'boot/axios'
import { useAuthStore } from 'stores/auth'

const user = ref('')
const pass = ref('')
const auth = useAuthStore()
const router = useRouter()

async function doLogin () {
  try {
    const { data } = await api.post('/auth/login', { user: user.value, pass: pass.value })
    auth.setCreds(data)
    router.push('/')              // führt ebenfalls durchs MainLayout
  } catch {
    Notify.create({ type: 'negative', message: 'Login failed' })
  }
}
</script>
