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
			class="flex space-x-2 p-2 rounded-md"
			:class="{
				'cursor-pointer': log.link,
			}"
			@click="navigateToPage(log)"
		>
			<Avatar :image="log.user_image" size="2xl" :label="log.full_name" />
			<div class="space-y-2">
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
							@click.stop="(e) => handleMarkAsRead(e, log.name)"
						>
							<template #icon>
								<X class="h-4 w-4 text-ink-gray-7 stroke-1.5" />
							</template>
						</Button>
					</div>
				</div>
				<div
					v-if="log.document_type == 'LMS Course' && log.document_details"
					class="flex space-x-5 border border-outline-gray-2 p-2 rounded-md"
				>
					<iframe
						v-if="log.document_details.video_link"
						:src="`https://www.youtube.com/embed/${log.document_details.video_link}`"
						class="rounded-md w-64"
					/>
					<div class="">
						<div
							class="bg-surface-violet-1 w-fit py-1 px-1.5 rounded-full text-ink-violet-1 text-sm mb-2"
						>
							{{ __('New Course') }}
						</div>
						<div class="font-semibold mb-1">
							{{ __(log.document_details.title) }}
						</div>
						<div class="leading-5">
							{{ __(log.document_details.short_introduction) }}
						</div>
						<div class="mt-5 space-y-2">
							<div
								v-for="instructor in log.document_details.instructors"
								class="flex items-center space-x-2"
							>
								<Avatar
									:size="'sm'"
									:image="instructor.user_image"
									:label="instructor.full_name"
								/>
								<span class="text-ink-gray-7 text-sm">
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
import { X } from 'lucide-vue-next'

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
		for_user: user.data?.name,
		read: 1,
	},
	auto: true,
	cache: 'Read Notifications',
})

const markAsRead = createResource({
	url: 'lms.lms.api.mark_as_read',
	makeParams(values) {
		return {
			name: values.name,
		}
	},
	onSuccess(data) {
		unReadNotifications.reload()
		readNotifications.reload()
	},
})

const markAllAsRead = createResource({
	url: 'lms.lms.api.mark_all_as_read',
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
	/* handleMarkAsRead(log.name) */
	let link = log.link.split('/')
	console.log(link)
	if (link[2] == 'courses') {
		router.push({
			name: 'CourseDetail',
			params: { courseName: link[3] },
		})
	} else if (link[2] == 'batches') {
		router.push({
			name: 'Batch',
			params: { batchName: link[3] },
		})
	}
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
