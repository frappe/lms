<template>
	<header
		class="sticky top-0 z-10 flex flex-col md:flex-row md:items-center justify-between border-b bg-white px-3 py-2.5 sm:px-5"
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
			class="flex items-center py-2 justify-between"
		>
			<div class="flex items-center">
				<UserAvatar :user="allUsers.data[log.from_user]" class="mr-2" />
				<div class="notification" v-html="log.subject"></div>
			</div>
			<div class="flex items-center space-x-2">
				<Link
					v-if="log.link"
					:to="log.link"
					@click="markAsRead.submit({ name: log.name })"
					class="text-gray-600 font-medium text-sm hover:text-gray-700"
				>
					{{ __('View') }}
				</Link>
				<Tooltip :text="__('Mark as read')">
					<Button
						variant="ghost"
						v-if="!log.read"
						@click="markAsRead.submit({ name: log.name })"
					>
						<template #icon>
							<X class="h-4 w-4 text-gray-700 stroke-1.5" />
						</template>
					</Button>
				</Tooltip>
			</div>
		</div>
		<div v-else class="text-gray-600">
			{{ __('Nothing to see here.') }}
		</div>
	</div>
</template>
<script setup>
import {
	createListResource,
	createResource,
	Breadcrumbs,
	Link,
	TabButtons,
	Button,
	Tooltip,
} from 'frappe-ui'
import { computed, inject, ref, onMounted } from 'vue'
import UserAvatar from '@/components/UserAvatar.vue'
import { useRouter } from 'vue-router'
import { X } from 'lucide-vue-next'
import { updateDocumentTitle } from '@/utils'

const user = inject('$user')
const socket = inject('$socket')
const allUsers = inject('$allUsers')
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
	fields: ['subject', 'from_user', 'link', 'read', 'name'],
	filters: {
		for_user: user.data?.name,
		read: 0,
	},
	orderBy: 'creation desc',
	auto: true,
	cache: 'Unread Notifications',
})

const readNotifications = createListResource({
	doctype: 'Notification Log',
	fields: ['subject', 'from_user', 'link', 'read', 'name'],
	filters: {
		for_user: user.data?.name,
		read: 1,
	},
	orderBy: 'creation desc',
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

const pageMeta = computed(() => {
	return {
		title: 'Notifications',
		description: 'All your notifications in one place.',
	}
})

updateDocumentTitle(pageMeta)
</script>
<style>
.notification strong {
	font-weight: 400;
}
.notification b {
	font-weight: 400;
}
</style>
