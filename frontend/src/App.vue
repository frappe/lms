<template>
	<Layout>
		<router-view />
	</Layout>
	<Dialogs />
	<Toasts />
</template>
<script setup>
import { Toasts } from 'frappe-ui'
import { Dialogs } from '@/utils/dialogs'
import { computed, onMounted, onUnmounted } from 'vue'
import { useScreenSize } from './utils/composables'
import DesktopLayout from './components/DesktopLayout.vue'
import MobileLayout from './components/MobileLayout.vue'
import { stopSession } from '@/telemetry'
import { init as initTelemetry } from '@/telemetry'

const screenSize = useScreenSize()

const Layout = computed(() => {
	if (screenSize.width < 640) {
		return MobileLayout
	} else {
		return DesktopLayout
	}
})

onMounted(async () => {
	await initTelemetry()
})

onUnmounted(() => {
	stopSession()
})
</script>
