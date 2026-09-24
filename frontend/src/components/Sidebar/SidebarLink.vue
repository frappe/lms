<template>
	<SidebarItem
		v-if="link && !link.onlyMobile"
		:label="__(link.label)"
		:icon="icon"
		:route="target.route"
		:href="safeUrl(target.href)"
		:active="isActive"
		:data-notifications-trigger="link.panel === 'notifications' ? '' : null"
		@click="target.onClick?.()"
	>
		<Tooltip :text="__(link.label)" side="right" :hoverDelay="1500">
			<span class="truncate text-p-sm">
				{{ __(link.label) }}
			</span>
		</Tooltip>
		<template #suffix>
			<KeyboardShortcut
				v-if="link.shortcut"
				bg
				:combo="link.shortcut"
				class="me-2"
			/>
			<span v-else-if="link.count" class="me-2 text-p-xs text-ink-gray-5">
				{{ link.count }}
			</span>
		</template>
	</SidebarItem>
	<ContactUsEmail v-if="isContactLink" v-model="showContactForm" />
</template>
<script setup lang="ts">
import { KeyboardShortcut, SidebarItem, Tooltip } from 'frappe-ui'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import ContactUsEmail from '@/components/ContactUsEmail.vue'
import * as icons from 'lucide-vue-next'
import { toggleNotifications } from '@/stores/notifications'
import { useSettings } from '@/stores/settings'
import type { SidebarLink } from '@/types'
import { openExternal } from '@/utils/openExternal'
import { safeUrl } from '@/utils/safeUrl'

interface Target {
	route?: { name: string }
	href?: string
	onClick?: () => void
}

const router = useRouter()
const settingsStore = useSettings()
const showContactForm = ref<boolean>(false)

const props = defineProps<{ link: SidebarLink }>()

const icon = computed(() =>
	typeof props.link.icon === 'string'
		? (icons as Record<string, unknown>)[props.link.icon]
		: props.link.icon
)

// A URL can carry an `@` in its path, and an External row's target is
// whatever an admin typed, so the mailto guess only applies without a scheme.
const isContactLink = computed(() =>
	Boolean(
		props.link.to?.includes('@') &&
			!props.link.to.startsWith('http') &&
			!router.hasRoute(props.link.to)
	)
)

const target = computed<Target>(() => {
	const { action, panel, to, open_in_new_window } = props.link
	if (action === 'commandPalette')
		return { onClick: () => (settingsStore.isCommandPaletteOpen = true) }
	if (panel === 'notifications') return { onClick: toggleNotifications }
	if (!to) return {}
	if (router.hasRoute(to)) return { route: { name: to } }
	if (isContactLink.value)
		return { onClick: () => (showContactForm.value = true) }
	if (to.startsWith('http')) {
		if (open_in_new_window === 0) return { href: to }
		return { onClick: () => openExternal(to) }
	}
	// A Route row's target already begins with /; a Web Page's route does
	// not. Prefixing a second slash would make it scheme-relative and send
	// the browser off-site.
	return { href: to.startsWith('/') ? to : `/${to}` }
})

const isActive = computed<boolean>(() =>
	Boolean(
		props.link.activeFor?.includes(router.currentRoute.value.name as string)
	)
)
</script>
