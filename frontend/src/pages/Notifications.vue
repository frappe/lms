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
	<div class="w-3/4 mx-auto px-5 pt-6 divide-y">
		<div
			v-if="notifications?.length"
			v-for="log in notifications"
			:key="log.name"
			class="flex items-center py-2 justify-between"
		>
			<div class="flex items-center">
				<Avatar :image="log.user_image" :label="log.full_name" class="mr-2" />
				<div class="notification text-ink-gray-7" v-html="log.subject"></div>
			</div>
			<div class="flex items-center space-x-2">
				<Link
					v-if="log.link"
					:to="log.link"
					@click="(e) => handleMarkAsRead(e, log.name)"
					class="text-ink-gray-5 font-medium text-sm hover:text-ink-gray-7"
				>
					{{ __('View') }}
				</Link>
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
		<div v-else class="text-ink-gray-5">
			{{ __('Nothing to see here.') }}
		</div>
	</div>
</template>
<script setup>
import {
	Avatar,
	createListResource,
	createResource,
	Breadcrumbs,
	Link,
	TabButtons,
	Button,
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
