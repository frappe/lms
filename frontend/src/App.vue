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

const screenSize = useScreenSize()
const MobileLayout = defineAsyncComponent(() =>
	import('@/components/MobileLayout.vue')
)
const DesktopLayout = defineAsyncComponent(() =>
	import('@/components/DesktopLayout.vue')
)

const Layout = computed(() => {
	if (screenSize.width < 640) {
		return MobileLayout
	} else {
		return DesktopLayout
	}
})
</script>
