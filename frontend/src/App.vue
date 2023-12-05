<template>
  <DesktopLayout>
    <router-view />
  </DesktopLayout>
  <Toasts />
</template>

<script setup>
  import DesktopLayout from '@/components/DesktopLayout.vue'
  import { Toasts } from 'frappe-ui'
</script>
