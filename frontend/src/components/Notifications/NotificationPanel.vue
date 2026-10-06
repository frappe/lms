<template>
	<Teleport to="body">
		<div
			v-if="panelVisible"
			ref="panelRef"
			class="fixed z-30 bg-surface-base transition-all duration-300 ease-in-out"
			:class="isMobile ? 'inset-0' : 'top-0 bottom-0'"
			:style="
				isMobile
					? {}
					: {
							left: sidebarLeft,
							width: '400px',
							// A cast shadow is black alpha in either theme, the same way
							// frappe-ui's own --elevation-* values are.
							boxShadow: '8px 0px 8px rgba(0, 0, 0, 0.1)', // token-exempt: shadow
					  }
			"
		>
			<div class="flex h-full flex-col text-ink-gray-9">
				<div class="flex justify-between items-center">
					<div class="text-md font-medium text-ink-gray-8 px-4 pt-[15px] pb-3">
						{{ __('Notifications') }}
					</div>
					<div class="flex gap-1 me-3">
						<Tooltip v-if="hasUnread" :text="__('Mark all as read')">
							<Button
								variant="ghost"
								:label="__('Mark all as read')"
								@click="markAllAsRead.submit"
							>
								<template #icon>
									<span class="lucide-check-check size-4 text-ink-gray-7" />
								</template>
							</Button>
						</Tooltip>
						<Button
							v-if="isMobile"
							variant="ghost"
							:label="__('Close')"
							@click="closeNotifications"
						>
							<template #icon>
								<span class="lucide-x size-4 text-ink-gray-7" />
							</template>
						</Button>
					</div>
				</div>
				<TabButtons
					v-model="activeTab"
					:options="tabs"
					fluid
					class="px-4 py-1"
				/>
				<div class="flex h-full overflow-hidden">
					<div
						v-if="filtered.length"
						class="w-full divide-y divide-outline-gray-2 overflow-auto text-p-base"
					>
						<component
							:is="route ? 'router-link' : 'button'"
							v-for="{ n, route } in rows"
							:key="n.name"
							:to="route || undefined"
							:type="route ? undefined : 'button'"
							class="flex w-full cursor-pointer items-start gap-2.5 px-4 py-2.5 text-start hover:bg-surface-gray-2"
							:class="{ 'font-medium': !n.read }"
							@click="onSelect(n)"
						>
							<span v-if="!n.read" class="sr-only">{{ __('Unread') }}</span>
							<div class="mt-1 flex items-center gap-2.5">
								<div
									class="size-[5px] rounded-full"
									:class="n.read ? 'bg-transparent' : 'bg-surface-gray-7'"
								/>
								<Avatar
									:image="n.from_user_details?.user_image"
									:label="n.from_user_details?.full_name"
									size="lg"
								/>
							</div>
							<div>
								<div v-safe-html:basic="decodeEntities(n.subject)" />
								<div class="text-p-sm text-ink-gray-6">
									{{ dayjs(n.creation).fromNow() }}
								</div>
							</div>
						</component>
					</div>
					<EmptyStateLayout
						v-else
						name="Notifications"
						:title="emptyTitle"
						:description="emptyDescription"
						icon="lucide-bell"
						width="lg"
					/>
				</div>
			</div>
		</div>
	</Teleport>
</template>
<script setup>
import { Avatar, Button, TabButtons, Tooltip } from 'frappe-ui'
import { computed, inject, ref, watch } from 'vue'
import { onClickOutside } from '@vueuse/core'
import { decodeEntities } from '@/utils'
import { assignmentSubmissionFromLink } from '@/utils/notificationLinks'
import { useSidebar } from '@/stores/sidebar'
import { useScreenSize } from '@/utils/composables'
import EmptyStateLayout from '@/components/Layouts/EmptyStateLayout.vue'
import {
	panelVisible,
	closeNotifications,
	notifications,
	markAsRead,
	markAllAsRead,
} from '@/stores/notifications'

const dayjs = inject('$dayjs')
const sidebarStore = useSidebar()
const { isMobile } = useScreenSize()

const panelRef = ref(null)
const activeTab = ref('Unread')
const tabs = [
	{ label: __('Unread'), value: 'Unread' },
	{ label: __('Read'), value: 'Read' },
]

onClickOutside(panelRef, () => closeNotifications(), {
	ignore: ['[data-notifications-trigger]'],
})

const filtered = computed(() => {
	const data = notifications.data || []
	return activeTab.value === 'Unread'
		? data.filter((n) => !n.read)
		: data.filter((n) => n.read)
})

const rows = computed(() =>
	filtered.value.map((n) => ({ n, route: notificationRoute(n) }))
)

const emptyTitle = computed(() =>
	activeTab.value === 'Unread'
		? __('No unread notifications')
		: __('No read notifications')
)

const emptyDescription = computed(() =>
	activeTab.value === 'Unread'
		? __("You're all caught up! Check back later for updates.")
		: __('Notifications you have read will appear here.')
)

const sidebarLeft = computed(() =>
	sidebarStore.isSidebarCollapsed ? '3rem' : '14rem'
)

const hasUnread = computed(() => notifications.data?.some((n) => !n.read))

// Fetch on open (and refresh whenever the panel is reopened).
watch(panelVisible, (open) => {
	if (open) notifications.reload()
})

const onSelect = (n) => {
	if (!n.read) markAsRead.submit({ name: n.name })
	closeNotifications()
}

const notificationRoute = (log) => {
	if (!log.link) return null
	const submission = assignmentSubmissionFromLink(log.link)
	if (submission) return { name: 'AssignmentSubmission', params: submission }
	let link = log.link.split('/')
	if (link[2] == 'courses') {
		return { name: 'CourseDetail', params: { courseName: link[3] } }
	} else if (link.includes('batches')) {
		const batchTarget = link.pop()
		const [batchName, hashValue] = batchTarget.split('#')
		return {
			name: 'BatchDetail',
			params: { batchName },
			hash: hashValue ? `#${hashValue}` : '',
		}
	}
	return null
}
</script>
