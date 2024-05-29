<template>
	<div
		class="flex h-full flex-col justify-between transition-all duration-300 ease-in-out bg-gray-50"
		:class="isSidebarCollapsed ? 'w-14' : 'w-56'"
	>
		<div
			class="flex flex-col overflow-hidden"
			:class="isSidebarCollapsed ? 'items-center' : ''"
		>
			<UserDropdown class="p-2" :isCollapsed="isSidebarCollapsed" />
			<div class="flex flex-col overflow-y-auto" v-if="sidebarSettings.data">
				<SidebarLink
					v-for="link in sidebarLinks"
					:link="link"
					:isCollapsed="isSidebarCollapsed"
					class="mx-2 my-0.5"
				/>
			</div>
		</div>
		<SidebarLink
			:link="{
				label: isSidebarCollapsed ? 'Expand' : 'Collapse',
			}"
			:isCollapsed="isSidebarCollapsed"
			@click="isSidebarCollapsed = !isSidebarCollapsed"
			class="m-2"
		>
			<template #icon>
				<span class="grid h-5 w-6 flex-shrink-0 place-items-center">
					<CollapseSidebar
						class="h-4.5 w-4.5 text-gray-700 duration-300 ease-in-out"
						:class="{ '[transform:rotateY(180deg)]': isSidebarCollapsed }"
					/>
				</span>
			</template>
		</SidebarLink>
	</div>
</template>

<script setup>
import UserDropdown from '@/components/UserDropdown.vue'
import CollapseSidebar from '@/components/Icons/CollapseSidebar.vue'
import SidebarLink from '@/components/SidebarLink.vue'
import { useStorage } from '@vueuse/core'
import { ref, onMounted, inject } from 'vue'
import { getSidebarLinks } from '../utils'
import { sessionStore } from '@/stores/session'
import { Bell, File } from 'lucide-vue-next'
import { createResource } from 'frappe-ui'

const { user } = sessionStore()
const socket = inject('$socket')
const unreadCount = ref(0)
const sidebarLinks = ref(getSidebarLinks())

onMounted(() => {
	socket.on('publish_lms_notifications', (data) => {
		unreadNotifications.reload()
	})

	if (user) {
		sidebarLinks.value.push({
			label: 'Notifications',
			icon: Bell,
			to: 'Notifications',
			activeFor: ['Notifications'],
			count: unreadCount.value,
		})
	}
})

const unreadNotifications = createResource({
	cache: 'Unread Notifications Count',
	url: 'frappe.client.get_count',
	makeParams(values) {
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
		sidebarLinks.value = sidebarLinks.value.map((link) => {
			if (link.label === 'Notifications') {
				link.count = data
			}
			return link
		})
	},
	auto: user ? true : false,
})

const sidebarSettings = createResource({
	url: 'lms.lms.api.get_sidebar_settings',
	cache: 'Sidebar Settings',
	auto: true,
	onSuccess(data) {
		Object.keys(data).forEach((key) => {
			if (!parseInt(data[key])) {
				sidebarLinks.value = sidebarLinks.value.filter(
					(link) => link.label.toLowerCase() !== key
				)
			}
		})
		if (data.nav_items) {
			data.nav_items.forEach((item) => {
				sidebarLinks.value.push({
					label: item.label,
					icon: File,
					to: item.url,
					activeFor: [item.label],
				})
			})
		}
		console.log(data)
	},
})

const getSidebarFromStorage = () => {
	return useStorage('sidebar_is_collapsed', false)
}

let isSidebarCollapsed = ref(getSidebarFromStorage())
</script>
