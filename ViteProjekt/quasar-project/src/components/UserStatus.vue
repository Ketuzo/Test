<template>
  <q-btn-dropdown v-if="auth.isLogged" icon="person" flat color="secondary">
    <q-list>
      <q-item-label header>{{ auth.user?.username }}</q-item-label>
      <q-item clickable @click="auth.logout">
        <q-item-section>Logout</q-item-section>
      </q-item>
    </q-list>
  </q-btn-dropdown>
</template>

<script setup>
import { useAuthStore } from 'stores/auth'
const auth = useAuthStore()
</script>
