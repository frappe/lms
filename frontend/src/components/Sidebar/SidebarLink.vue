<template>
	<button
		v-if="link && !link.onlyMobile"
		:data-notifications-trigger="link.panel === 'notifications' ? '' : null"
		class="flex w-full h-7 cursor-pointer items-center rounded text-ink-gray-8 duration-300 ease-in-out focus:outline-none focus:transition-none focus-visible:rounded focus-visible:ring-2 focus-visible:ring-outline-gray-3"
		:class="
			isActive ? 'bg-surface-elevation-3 shadow-sm' : 'hover:bg-surface-gray-2'
		"
		@click="handleClick"
	>
		<div
			class="flex items-center w-full duration-300 ease-in-out group"
			:class="isCollapsed ? 'p-1 relative' : 'px-2 py-1'"
		>
			<Tooltip
				:text="__(link.label)"
				placement="right"
				:disabled="!isCollapsed"
			>
				<slot name="icon">
					<span class="grid size-4 flex-shrink-0 place-items-center">
						<component
							:is="typeof link.icon === 'string' ? icons[link.icon] : link.icon"
							class="h-4 w-4 stroke-1.5 text-ink-gray-8"
						/>
					</span>
				</slot>
			</Tooltip>
			<Tooltip
				:text="__(link.label)"
				placement="right"
				:disabled="isCollapsed"
				:hoverDelay="1.5"
			>
				<span
					class="min-w-0 truncate text-p-sm duration-300 ease-in-out"
					:class="
						isCollapsed
							? 'ms-0 w-0 overflow-hidden opacity-0'
							: 'ms-2 w-auto opacity-100'
					"
				>
					{{ __(link.label) }}
				</span>
			</Tooltip>
			<KeyboardShortcut
				v-if="link.shortcut && !isCollapsed"
				bg
				:combo="link.shortcut"
				class="!ms-auto"
			/>
			<span
				v-if="link.count && !isCollapsed"
				class="!ms-auto block text-p-xs text-ink-gray-5"
				:class="
					isCollapsed && link.count > 9
						? 'absolute top-[2px] end-0 bg-surface-base'
						: ''
				"
			>
				{{ link.count }}
			</span>
		</div>
	</button>
	<ContactUsEmail v-model="showContactForm" />
</template>
<script setup lang="ts">
import { KeyboardShortcut, Tooltip } from 'frappe-ui'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import ContactUsEmail from '@/components/ContactUsEmail.vue'
import * as icons from 'lucide-vue-next'
import { toggleNotifications } from '@/stores/notifications'
import { useSettings } from '@/stores/settings'
import type { SidebarLink } from '@/types'
import { openExternal } from '@/utils/openExternal'
import { safeUrl } from '@/utils/safeUrl'

const router = useRouter()
const settingsStore = useSettings()
const showContactForm = ref<boolean>(false)

const props = withDefaults(
	defineProps<{
		link: SidebarLink
		isCollapsed?: boolean
		activeTab?: string
	}>(),
	{
		isCollapsed: false,
		activeTab: '',
	}
)

function handleClick(): void {
	if (props.link.action === 'commandPalette') {
		settingsStore.isCommandPaletteOpen = true
		return
	}
	if (props.link.panel === 'notifications') {
		toggleNotifications()
		return
	}
	if (props.link.to && router.hasRoute(props.link.to)) {
		router.push({ name: props.link.to })
		// A URL can carry an `@` in its path, and an External row's target is
		// whatever an admin typed, so the mailto guess only applies without a scheme.
	} else if (
		props.link.to?.includes('@') &&
		!props.link.to.startsWith('http')
	) {
		showContactForm.value = true
	} else if (props.link.to) {
		if (props.link.to.startsWith('http')) {
			if (props.link.open_in_new_window === 0) {
				const href = safeUrl(props.link.to)
				if (href) window.location.href = href
				return
			}
			openExternal(props.link.to)
			return
		}
		// A Route row's target already begins with /; a Web Page's route does
		// not. Prefixing a second slash would make it scheme-relative and send
		// the browser off-site.
		window.location.href = props.link.to.startsWith('/')
			? props.link.to
			: `/${props.link.to}`
	}
}

const isActive = computed<boolean>(() => {
	return Boolean(
		props.link?.activeFor?.includes(router.currentRoute.value.name as string) ||
			(props.activeTab && props.link?.label?.includes(props.activeTab))
	)
})
</script>
