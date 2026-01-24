<template>
	<Popover :placement="placement">
		<template #target="{ togglePopover }">
			<Button
				@click="togglePopover()"
				variant="ghost"
				class="relative text-ink-gray-7 !bg-gray-50 !w-10 !h-10 rounded-full"
			>
				<Bell class="h-5 w-5 stroke-1.5" />
				<span
					v-if="unreadCount > 0"
					class="absolute top-2.5 right-3 h-2 w-2 rounded-full bg-red-500 border"
				></span>
			</Button>
		</template>
		<template #body>
			<div
				class="w-96 h-96 bg-white rounded flex flex-col border border-gray-100 shadow-sm mt-2"
			>
				<div class="flex items-center justify-between border-b p-4">
					<h2 class="text-lg font-semibold">Notifications</h2>
					<Button
						variant="ghost"
						class="!text-sm bg-transparent !px-0"
						:class="
							unreadCount > 0
								? 'text-secondary-500 cursor-pointer'
								: 'text-gray-400 cursor-default'
						"
						@click="unreadCount > 0 ? markAllAsRead.submit() : null"
						:loading="markAllAsRead.loading"
					>
						{{ __('Mark all as read') }}
					</Button>
				</div>
				<div class="flex-1 p-4 overflow-y-auto">
					<div
						v-if="notifications?.data?.length"
						v-for="log in notifications?.data"
						:key="log.name"
						class="flex items-center py-2 justify-between"
					>
						<div
							class="flex items-start bg-[#F2FFFC] p-4 rounded-xl border border-gray-100 w-full space-x-4 cursor-pointer"
							@click="(e) => handleMarkAsRead(e, log.name)"
							:class="!log.read ? 'bg-[#F2FFFC]' : 'bg-white'"
						>
							<div v-if="log.document_type === 'LMS Quiz Submission'">
								<img
									src="/icons/score.png"
									alt="score"
									class="w-10 h-10 flex-shrink-0"
								/>
							</div>
							<div v-else>
								<img
									src="/icons/notif.png"
									alt="score"
									class="w-10 h-10 flex-shrink-0"
								/>
							</div>
							<div class="notification flex-1">
								<div
									class="text-gray-900 text-md md:font-medium md:text-lg"
									v-html="log.subject"
								></div>
								<div class="text-gray-700 font-regular text-sm md:text-md">
									{{ dayjs(log?.creation).fromNow() }}
								</div>
							</div>
						</div>
					</div>
					<div
						v-else
						class="min-h-full flex-1 flex flex-col items-center justify-center"
					>
						<EmptyIcon />
						<h2 class="text-lg font-semibold text-gray-900 mt-4">
							Everything looks quiet for now
						</h2>
						<p class="text-gray-600 text-sm">
							Your learning updates will show up here soon
						</p>
					</div>
				</div>
				<div
					class="border-t flex justify-center items-center py-2 text-secondary-500 text-sm cursor-pointer font-medium"
					@click="router.push({ name: 'Notifications' })"
				>
					View all notification
				</div>
			</div>
		</template>
	</Popover>
</template>

<script setup>
import { ref, onMounted, onUnmounted, inject, watch } from 'vue'
import { useRouter } from 'vue-router'
import { sessionStore } from '@/stores/session'
import { createListResource, createResource, Button, Popover } from 'frappe-ui'
import EmptyIcon from '@/components/Icons/EmptyIcon.vue'
import { Bell } from 'lucide-vue-next'
import dayjs from 'dayjs'

const props = defineProps({
	placement: {
		type: String,
		default: 'bottom-end',
	},
})

const router = useRouter()
const { user, isLoggedIn } = sessionStore()
const socket = inject('$socket')

const unreadCount = ref(0)

const unreadNotifications = createResource({
	cache: 'Unread Notifications Count',
	url: 'frappe.client.get_count',
	makeParams() {
		return {
			doctype: 'Notification Log',
			filters: {
				for_user: user,
				read: 0,
			},
		}
	},
	onSuccess(data) {
		unreadCount.value = data
	},
	auto: false,
})

const notifications = createListResource({
	doctype: 'Notification Log',
	url: 'lms.lms.api.get_notifications',
	filters: {
		for_user: user.data?.name,
		read: 0,
	},
	auto: true,
	cache: 'Unread Notifications',
})

const readNotifications = createListResource({
	doctype: 'Notification Log',
	url: 'lms.lms.api.get_notifications',
	filters: {
		for_user: user?.data?.name,
		read: 1,
	},
	auto: true,
	cache: 'Read Notifications',
})

const markAllAsRead = createResource({
	url: 'lms.lms.api.mark_all_as_read',
	onSuccess() {
		unreadNotifications.reload()
		readNotifications.reload()
		notifications.reload()
	},
})

const markAsRead = createResource({
	url: 'lms.lms.api.mark_as_read',
	makeParams(values) {
		return {
			name: values.name,
		}
	},
	onSuccess() {
		unreadNotifications.reload()
		readNotifications.reload()
		notifications.reload()
	},
})

const handleMarkAsRead = (e, logName) => {
	markAsRead.submit({ name: logName })
}

onMounted(() => {
	if (isLoggedIn) {
		unreadNotifications.reload()
	}

	socket.on('publish_lms_notifications', () => {
		unreadNotifications.reload()
		notifications.reload()
	})
})

onUnmounted(() => {
	socket.off('publish_lms_notifications')
})
</script>
