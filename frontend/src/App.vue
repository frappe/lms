<template>
	<FrappeUIProvider>
		<Layout class="isolate text-p-base">
			<router-view />
		</Layout>
		<NotificationPanel />
		<ContinueCoursePanel
			v-if="canHaveDraft"
			:user="userResource.data.name"
			:besideHelp="helpPanelOpen"
		/>
		<InstallPrompt v-if="isMobile && !settings.data?.disable_pwa" />
		<Dialogs />
	</FrappeUIProvider>
</template>
<script setup>
import { FrappeUIProvider } from 'frappe-ui'
import { Dialogs } from '@/utils/dialogs'
import { computed } from 'vue'
import { useScreenSize } from './utils/composables'
import { useSettings } from '@/stores/settings'
import { useRoute } from 'vue-router'
import DesktopLayout from './components/Layouts/DesktopLayout.vue'
import MobileLayout from './components/Layouts/MobileLayout.vue'
import NoSidebarLayout from './components/Layouts/NoSidebarLayout.vue'
import InstallPrompt from './components/InstallPrompt.vue'
import NotificationPanel from '@/components/Notifications/NotificationPanel.vue'
import ContinueCoursePanel from '@/components/ContinueCoursePanel.vue'
import { showHelpModal } from '@framework/ui/components/Onboarding/index'
import { seesOnboarding } from '@/utils/onboarding'
import { usersStore } from '@/stores/user'

const { isMobile } = useScreenSize()
const route = useRoute()
const { userResource } = usersStore()

// The panel lives here, not in the sidebar, so it shows on every layout: the
// mobile one and the pages without a sidebar have no AppSidebar. Only people
// who can author a course get it, so a student never pays for the call.
const canHaveDraft = computed(() => {
	const user = userResource.data
	return Boolean(user?.name && (user.is_instructor || user.is_moderator))
})

// The Getting started help panel is the sidebar's: it opens for the users who
// see onboarding, and is gone with the sidebar on the layouts without one even
// though its open flag outlives the sidebar.
const helpPanelOpen = computed(
	() =>
		!isMobile.value &&
		!noSidebar.value &&
		seesOnboarding(userResource.data) &&
		showHelpModal.value
)

const { settings } = useSettings()

// Derive the layout from the current route, not a navigation guard. Flipping it
// in beforeEach swaps the layout the instant a navigation starts (before a lazy
// route component resolves), which re-mounts <router-view> while the old page is
// still showing, flashing it back into view. A route-driven computed changes in
// the same tick as the route, so the swap and the page change happen together.
const noSidebar = computed(
	() => Boolean(route.query.fromLesson) || route.path === '/persona'
)

const Layout = computed(() => {
	if (noSidebar.value) {
		return NoSidebarLayout
	}
	if (isMobile.value) {
		return MobileLayout
	}
	return DesktopLayout
})
</script>
