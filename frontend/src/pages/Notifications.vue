<template>
	<header
		class="sticky top-0 z-10 flex flex-col md:flex-row md:items-center justify-between border-b bg-surface-white px-3 py-2.5 sm:px-5"
	>
		<Breadcrumbs :items="breadcrumbs" />
		<div class="flex items-center space-x-2">
			<Button
				@click="markAllAsRead.submit"
				:loading="markAllAsRead.loading"
				v-if="activeTab === 'Unread' && unReadNotifications.data?.length > 0"
			>
				{{ __('Mark all as read') }}
			</Button>
			<TabButtons
				class="inline-block"
				:buttons="[{ label: 'Unread', active: true }, { label: 'Read' }]"
				v-model="activeTab"
			/>
		</div>
	</header>
	<div class="w-full md:w-3/4 mx-auto px-5 pt-6 divide-y">
		<div
			v-if="notifications?.length"
			v-for="log in notifications"
			:key="log.name"
			class="flex space-x-2 px-2 py-4"
			:class="{
				'cursor-pointer': log.link,
				'items-center': !showDetails(log) && !isMentionOrComment(log),
			}"
			@click="navigateToPage(log)"
		>
			<Avatar
				:image="log.from_user_details.user_image"
				size="xl"
				:label="log.from_user_details.full_name"
			/>
			<div class="space-y-2 w-full">
				<div class="flex items-center justify-between">
					<div class="flex items-center">
						<div class="text-ink-gray-9" v-html="log.subject"></div>
					</div>
					<div class="flex items-center space-x-2">
						<div class="text-sm text-ink-gray-5">
							{{ dayjs(log.creation).fromNow() }}
						</div>
						<Button
							variant="ghost"
							v-if="!log.read"
							@click.stop="(e) => handleMarkAsRead(log.name)"
						>
							<template #icon>
								<X class="h-4 w-4 text-ink-gray-7 stroke-1.5" />
							</template>
						</Button>
					</div>
				</div>
				<div
					v-if="isMentionOrComment(log)"
					v-html="log.email_content"
					class="bg-surface-gray-2 rounded-md px-3 py-2 line-clamp-3 overflow-hidden"
				></div>
				<div
					v-else-if="showDetails(log)"
					class="flex items-stretch border border-outline-gray-2 space-x-2 rounded-md"
				>
					<iframe
						v-if="
							log.document_type == 'LMS Course' &&
							log.document_details.video_link
						"
						:src="`https://www.youtube.com/embed/${log.document_details.video_link}`"
						class="rounded-l-md w-72"
					/>
					<video
						v-else-if="
							log.document_type == 'LMS Batch' &&
							log.document_details.video_link
						"
						:src="log.document_details.video_link"
						class="rounded-l-md w-72"
					/>
					<div class="p-3">
						<div
							class="bg-surface-violet-1 w-fit py-1 px-1.5 rounded-full text-ink-violet-1 text-sm mb-2"
						>
							{{
								log.document_type === 'LMS Course'
									? __('New Course')
									: __('New Batch')
							}}
						</div>
						<div class="font-semibold mb-1">
							{{ __(log.document_details.title) }}
						</div>
						<div class="leading-5">
							{{ __(log.document_details.short_introduction) }}
						</div>
						<div
							v-if="log.document_details.start_date"
							class="flex items-center space-x-2 text-sm mt-5"
						>
							<Calendar class="size-3 stroke-1.5" />
							<span>
								{{
									dayjs(log.document_details.start_date).format('DD MMM YYYY')
								}}
							</span>
						</div>
						<div
							v-if="log.document_details.start_time"
							class="flex items-center space-x-2 text-sm mt-2"
						>
							<Clock class="size-3 stroke-1.5" />
							<span>
								{{ formatTime(log.document_details.start_time) }}
								{{ log.document_details.timezone }}
							</span>
						</div>
						<div
							v-if="log.document_details.instructors.length > 1"
							class="space-y-2 mt-5"
						>
							<div
								v-for="instructor in log.document_details.instructors"
								class="flex items-center space-x-2"
							>
								<Avatar
									:size="'sm'"
									:image="instructor.user_image"
									:label="instructor.full_name"
								/>
								<span class="font-medium text-sm">
									{{ instructor.full_name }}
								</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
		<div v-else class="text-ink-gray-5">
			{{ __('Nothing to see here.') }}
		</div>
	</div>
</template>
<script setup>
import {
	Avatar,
	Breadcrumbs,
	Button,
	createListResource,
	createResource,
	dayjs,
	TabButtons,
	usePageMeta,
} from 'frappe-ui'
import { sessionStore } from '../stores/session'
import { computed, inject, ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { Calendar, Clock, X } from 'lucide-vue-next'
import { formatTime } from '@/utils/'

const { brand } = sessionStore()
const user = inject('$user')
const socket = inject('$socket')
const activeTab = ref('Unread')
const router = useRouter()

onMounted(() => {
	if (!user.data) router.push({ name: 'Courses' })

	socket.on('publish_lms_notifications', (data) => {
		unReadNotifications.reload()
	})
})

const notifications = computed(() => {
	return activeTab.value === 'Unread'
		? unReadNotifications.data
		: readNotifications.data
})

const unReadNotifications = createListResource({
	doctype: 'Notification Log',
	url: 'lms.lms.api.get_notifications',
	filters: {
		read: 0,
	},
	auto: user.data ? true : false,
	cache: 'Unread Notifications',
})

const readNotifications = createListResource({
	doctype: 'Notification Log',
	url: 'lms.lms.api.get_notifications',
	filters: {
		read: 1,
	},
	auto: user.data ? true : false,
	cache: 'Read Notifications',
})

const markAsRead = createResource({
	url: 'frappe.desk.doctype.notification_log.notification_log.mark_as_read',
	makeParams(values) {
		return {
			docname: values.name,
		}
	},
	onSuccess(data) {
		unReadNotifications.reload()
		readNotifications.reload()
	},
})

const markAllAsRead = createResource({
	url: 'frappe.desk.doctype.notification_log.notification_log.mark_all_as_read',
	onSuccess(data) {
		unReadNotifications.reload()
		readNotifications.reload()
	},
})

const handleMarkAsRead = (logName) => {
	markAsRead.submit({ name: logName })
}

const navigateToPage = (log) => {
	if (!log.link) return
	handleMarkAsRead(log.name)
	let link = log.link.split('/')
	if (link[2] == 'courses') {
		router.push({
			name: 'CourseDetail',
			params: { courseName: link[3] },
		})
	} else if (link.includes('batches')) {
		if (link.includes('details')) {
			router.push({
				name: 'BatchDetail',
				params: { batchName: link.pop() },
			})
		} else {
			router.push({
				name: 'Batch',
				params: { batchName: link.pop() },
			})
		}
	} else if (link.includes('assignment-submission')) {
		router.push({
			name: 'AssignmentSubmission',
			params: {
				submissionName: link[4],
				assignmentID: link[3],
			},
		})
	}
}

const isMentionOrComment = (log) => {
	if (log.type == 'Mention') {
		return true
	}
	if (log.subject.includes('mentioned you')) {
		return true
	}
	if (log.subject.includes('comment')) {
		return true
	}
	return false
}

const showDetails = (log) => {
	return (
		['LMS Course', 'LMS Batch'].includes(log.document_type) &&
		log.document_details
	)
}

onUnmounted(() => {
	socket.off('publish_lms_notifications')
})

const breadcrumbs = computed(() => {
	let crumbs = [
		{
			label: 'Notifications',
			route: {
				name: 'Notifications',
			},
		},
	]
	return crumbs
})

usePageMeta(() => {
	return {
		title: 'Notifications',
		icon: brand.favicon,
	}
})
</script>
