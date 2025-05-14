<template>
	<FrappeUIProvider>
		<Layout>
			<router-view />
		</Layout>
		<Dialogs />
	</FrappeUIProvider>
</template>
<script setup>
import { FrappeUIProvider } from 'frappe-ui'
import { Dialogs } from '@/utils/dialogs'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useScreenSize } from './utils/composables'
import DesktopLayout from './components/DesktopLayout.vue'
import MobileLayout from './components/MobileLayout.vue'
import NoSidebarLayout from './components/NoSidebarLayout.vue'
import { stopSession } from '@/telemetry'
import { init as initTelemetry } from '@/telemetry'
import { usersStore } from '@/stores/user'
import { useRouter } from 'vue-router'

const screenSize = useScreenSize()
let { userResource } = usersStore()
const router = useRouter()
const noSidebar = ref(false)

router.beforeEach((to, from, next) => {
	if (to.query.fromLesson || to.path === '/persona') {
		noSidebar.value = true
	} else {
		noSidebar.value = false
	}
	next()
})

const Layout = computed(() => {
	if (noSidebar.value) {
		return NoSidebarLayout
	}
	if (screenSize.width < 640) {
		return MobileLayout
	} else {
		return DesktopLayout
	}
})

onMounted(async () => {
	if (userResource.data) await initTelemetry()
})

onUnmounted(() => {
	noSidebar.value = false
	stopSession()
})
</script>
