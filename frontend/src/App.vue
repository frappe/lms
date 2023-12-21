<template>
  <DesktopLayout>
    <router-view />
  </DesktopLayout>
  <Dialogs />
  <Toasts />
</template>

<script setup>
  import DesktopLayout from '@/components/DesktopLayout.vue'
  import { Toasts } from 'frappe-ui'
  import { Dialogs } from '@/utils/dialogs'
</script>
