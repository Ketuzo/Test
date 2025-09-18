<template>
  <q-layout view="lHh Lpr lFf">
    <!-- Header -->
    <q-header elevated>
      <q-toolbar>
        <q-btn flat dense round icon="menu" @click="toggleLeftDrawer" />
        <q-toolbar-title>{{ currentPage }}</q-toolbar-title>
        <UserStatus />
        <q-toggle dense v-model="dark" @click="toggleDark" icon="dark_mode" color="yellow-8"/>
      </q-toolbar>
    </q-header>

    <!-- Drawer -->
    <q-drawer v-model="leftDrawerOpen" show-if-above bordered>
      <q-list>
        <q-item-label header>VITA</q-item-label>
        <NavLinks v-for="l in links" :key="l.title" v-bind="l" />
      </q-list>
    </q-drawer>

    <!-- Pages -->
    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useQuasar } from 'quasar'
import { useRoute } from 'vue-router'
import NavLinks   from 'components/NavLinks.vue'
import UserStatus from 'components/UserStatus.vue'

const links = [
  { title:'Dashboard',  caption:'dashboard',  icon:'dashboard',   link:'/' },
  { title:'Jobs',       caption:'jobs',       icon:'work',        link:'/jobs' },
  { title:'Workflows',  caption:'workflows',  icon:'engineering', link:'/workflows' },
  { title:'Settings',   caption:'settings',   icon:'settings',    link:'/settings' }
]

const $q = useQuasar()
const dark = ref($q.dark.isActive)
function toggleDark () { $q.dark.toggle(); dark.value = $q.dark.isActive }

const leftDrawerOpen = ref(false)
function toggleLeftDrawer(){ leftDrawerOpen.value = !leftDrawerOpen.value }

const route = useRoute()
const currentPage = computed(() => route.name || '')
</script>
