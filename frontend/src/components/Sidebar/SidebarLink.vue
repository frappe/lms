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
					<span class="grid h-5 w-6 flex-shrink-0 place-items-center">
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
					class="min-w-0 truncate text-sm leading-5 duration-300 ease-in-out"
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
				class="!ms-auto block text-xs text-ink-gray-5"
				:class="
					isCollapsed && link.count > 9
						? 'absolute top-[2px] end-0 bg-surface-base'
						: ''
				"
			>
				{{ link.count }}
			</span>
			<div
				v-if="showControls && !isCollapsed"
				class="flex items-center gap-x-2 !ms-auto block text-xs text-ink-gray-5 group-hover:visible invisible"
			>
				<component
					:is="icons['Edit']"
					class="h-3 w-3 stroke-1.5 text-ink-gray-7"
					@click.stop="openModal(link)"
				/>
				<component
					:is="icons['X']"
					class="h-3 w-3 stroke-1.5 text-ink-gray-7"
					@click.stop="deletePage(link)"
				/>
			</div>
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
import type { SidebarLink } from '@/types/sidebar'

const router = useRouter()
const settingsStore = useSettings()
const emit = defineEmits<{
	openModal: [link: SidebarLink]
	deletePage: [link: SidebarLink]
}>()
const showContactForm = ref<boolean>(false)

const props = withDefaults(
	defineProps<{
		link: SidebarLink
		isCollapsed?: boolean
		showControls?: boolean
		activeTab?: string
	}>(),
	{
		isCollapsed: false,
		showControls: false,
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
	} else if (props.link.to?.includes('@')) {
		showContactForm.value = true
	} else if (props.link.to) {
		if (props.link.to.startsWith('http')) {
			window.open(props.link.to, '_blank')
			return
		}
		window.location.href = `/${props.link.to}`
	}
}

const isActive = computed<boolean>(() => {
	return Boolean(
		props.link?.activeFor?.includes(router.currentRoute.value.name as string) ||
			(props.activeTab && props.link?.label?.includes(props.activeTab))
	)
})

function openModal(link: SidebarLink): void {
	emit('openModal', link)
}

function deletePage(link: SidebarLink): void {
	emit('deletePage', link)
}
</script>
