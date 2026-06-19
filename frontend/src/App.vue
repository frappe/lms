<template>
	<FrappeUIProvider>
		<Layout class="isolate text-p-base">
			<router-view />
		</Layout>
		<InstallPrompt v-if="isMobile && !settings.data?.disable_pwa" />
		<Dialogs />
	</FrappeUIProvider>
</template>
<script setup>
import { FrappeUIProvider } from 'frappe-ui'
import { Dialogs } from '@/utils/dialogs'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useScreenSize } from './utils/composables'
import { useSettings } from '@/stores/settings'
import { useRouter } from 'vue-router'
import DesktopLayout from './components/Layouts/DesktopLayout.vue'
import MobileLayout from './components/Layouts/MobileLayout.vue'
import NoSidebarLayout from './components/Layouts/NoSidebarLayout.vue'
import InstallPrompt from './components/InstallPrompt.vue'

const { isMobile } = useScreenSize()
const router = useRouter()
const noSidebar = ref(false)
const { settings } = useSettings()

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
	if (isMobile.value) {
		return MobileLayout
	}
	return DesktopLayout
})

// Disable right-click on course content pages (deterrent against casual
// copying of lesson material). Scoped to the student-facing content routes so
// authoring/admin pages keep the native context menu.
const RIGHT_CLICK_BLOCKED_ROUTES = ['Lesson', 'CourseDetail', 'SCORMChapter']
const blockContextMenu = (e) => {
	if (RIGHT_CLICK_BLOCKED_ROUTES.includes(router.currentRoute.value.name)) {
		e.preventDefault()
	}
}

onMounted(() => {
	document.addEventListener('contextmenu', blockContextMenu)
})

onUnmounted(() => {
	noSidebar.value = false
	document.removeEventListener('contextmenu', blockContextMenu)
})
</script>
