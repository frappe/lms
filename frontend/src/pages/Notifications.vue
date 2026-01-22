<template>
	<header
		class="sticky top-0 z-10 flex flex-row md:items-center justify-between bg-surface-white px-3 py-2.5 sm:px-5 border-b">
		<Breadcrumbs :items="breadcrumbs" />
		<div class="flex items-center space-x-2">
			<Button @click="markAllAsRead.submit" :loading="markAllAsRead.loading"
				class="text-secondary-500 bg-transparent"
				v-if="activeTab === 'Unread' && unReadNotifications.data?.length > 0">
				{{ __('Mark all as read') }}
			</Button>
			<!-- <TabButtons class="inline-block" :buttons="[{ label: 'Unread', active: true }, { label: 'Read' }]"
				v-model="activeTab" /> -->
		</div>
	</header>
	<div class="w-full mx-auto px-5 pt-6 divide-y">
		<div v-if="notifications?.data?.length" v-for="log in notifications?.data" :key="log.name"
			class="flex items-center py-2 justify-between">
			<div class="flex items-start p-4 rounded-xl border border-gray-100 w-full space-x-4 cursor-pointer"
			:class="!log.read ? 'bg-[#F2FFFC]' : 'bg-white'"
			 @click="(e) => handleMarkAsRead(e, log.name)">
				<!-- <Avatar :image="log.user_image" :label="log.full_name" class="mr-2" /> -->
				<div v-if="log.document_type === 'LMS Quiz Submission'">
					<img src="/icons/score.png" alt="score" class="w-10 h-10 flex-shrink-0" />
				</div>
				<div v-else>
					<img src="/icons/notif.png" alt="score" class="w-10 h-10 flex-shrink-0" />
				</div>
				<div class="notification flex-1">
					<div class="text-gray-900 text-md md:font-medium md:text-lg" v-html="log.subject"></div>
					<div class="text-gray-700 font-regular text-sm md:text-md">
						{{ dayjs(log.creation).fromNow() }}
					</div>
				</div>
			</div>
		</div>
		<div v-else>
			<div class="m-auto flex flex-col items-center mt-12">
				<EmptyIcon />
				<h2 class="text-lg font-semibold text-gray-900">Everything looks quiet for now</h2>
				<p class="text-gray-600">Your learning updates will show up here soon</p>
			</div>
		</div>
	</div>
</template>
<script setup>
import {
	Avatar,
	createListResource,
	createResource,
	Breadcrumbs,
	TabButtons,
	Button,
	usePageMeta,
} from 'frappe-ui'
import { sessionStore } from '../stores/session'
import { computed, inject, ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { Star, X } from 'lucide-vue-next'
import EmptyIcon from '@/components/Icons/EmptyIcon.vue'

import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);


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

// const notifications = computed(() => {
// 	return activeTab.value === 'Unread'
// 		? unReadNotifications.data
// 		: readNotifications.data
// })

const notifications = createListResource({
	doctype: 'Notification Log',
	url: 'lms.lms.api.get_notifications',
	filters: {
		for_user: user.data?.name,
	},
	auto: true,
	cache: 'Notifications',
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

const handleMarkAsRead = (e, logName) => {
	markAsRead.submit({ name: logName })
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
<style>
.notification strong {
	font-weight: 400;
}

.notification b {
	font-weight: 400;
}
</style>
