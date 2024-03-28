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
import { computed, defineAsyncComponent } from 'vue'
import { useScreenSize } from './utils/composables'
import DesktopLayout from './components/DesktopLayout.vue'
import MobileLayout from './components/MobileLayout.vue'

const screenSize = useScreenSize()

const Layout = computed(() => {
	if (screenSize.width < 640) {
		return MobileLayout
	} else {
		return DesktopLayout
	}
})
</script>
