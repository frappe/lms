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
			<div class="flex flex-col overflow-y-auto">
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
import { ref, onMounted, inject, computed } from 'vue'
import { getSidebarLinks } from '../utils'
import { sessionStore } from '@/stores/session'
import { Bell } from 'lucide-vue-next'
import { createResource } from 'frappe-ui'

const { user } = sessionStore()
const socket = inject('$socket')
const unreadCount = ref(0)

onMounted(() => {
	socket.on('publish_lms_notifications', (data) => {
		unreadNotifications.reload()
	})
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
	},
	auto: true,
})

const sidebarLinks = computed(() => {
	const links = getSidebarLinks()
	if (user) {
		links.push({
			label: 'Notifications',
			icon: Bell,
			to: 'Notifications',
			activeFor: ['Notifications'],
			count: unreadCount.value,
		})
	}
	return links
})

const getSidebarFromStorage = () => {
	return useStorage('sidebar_is_collapsed', false)
}

let isSidebarCollapsed = ref(getSidebarFromStorage())
</script>
