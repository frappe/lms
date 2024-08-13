<template>
	<div
		class="flex h-full flex-col justify-between transition-all duration-300 ease-in-out bg-gray-50"
		:class="isSidebarCollapsed ? 'w-14' : 'w-56'"
	>
		<div
			class="flex flex-col overflow-hidden"
			:class="isSidebarCollapsed ? 'items-center' : ''"
		>
			<UserDropdown :isCollapsed="isSidebarCollapsed" />
			<div class="flex flex-col" v-if="sidebarSettings.data">
				<SidebarLink
					v-for="link in sidebarLinks"
					:link="link"
					:isCollapsed="isSidebarCollapsed"
					class="mx-2 my-0.5"
				/>
			</div>
			<div
				v-if="sidebarSettings.data?.web_pages?.length || isModerator"
				class="mt-4"
			>
				<div
					class="flex items-center justify-between pr-2 cursor-pointer"
					:class="isSidebarCollapsed ? 'pl-3' : 'pl-4'"
					@click="showWebPages = !showWebPages"
				>
					<div
						v-if="!isSidebarCollapsed"
						class="flex items-center text-sm text-gray-600 my-1"
					>
						<span class="grid h-5 w-6 flex-shrink-0 place-items-center">
							<ChevronRight
								class="h-4 w-4 stroke-1.5 text-gray-900 transition-all duration-300 ease-in-out"
								:class="{ 'rotate-90': showWebPages }"
							/>
						</span>
						<span class="ml-2">
							{{ __('More') }}
						</span>
					</div>
					<Button v-if="isModerator" variant="ghost" @click="openPageModal()">
						<template #icon>
							<Plus class="h-4 w-4 text-gray-700 stroke-1.5" />
						</template>
					</Button>
				</div>
				<div
					v-if="sidebarSettings.data?.web_pages?.length"
					class="flex flex-col transition-all duration-300 ease-in-out"
					:class="showWebPages ? 'block' : 'hidden'"
				>
					<SidebarLink
						v-for="link in sidebarSettings.data.web_pages"
						:link="link"
						:isCollapsed="isSidebarCollapsed"
						class="mx-2 my-0.5"
						:showControls="isModerator ? true : false"
						@openModal="openPageModal"
						@deletePage="deletePage"
					/>
				</div>
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
	<PageModal
		v-model="showPageModal"
		v-model:reloadSidebar="sidebarSettings"
		:page="pageToEdit"
	/>
</template>

<script setup>
import UserDropdown from '@/components/UserDropdown.vue'
import CollapseSidebar from '@/components/Icons/CollapseSidebar.vue'
import SidebarLink from '@/components/SidebarLink.vue'
import { useStorage } from '@vueuse/core'
import { ref, onMounted, inject, watch } from 'vue'
import { getSidebarLinks } from '../utils'
import { usersStore } from '@/stores/user'
import { sessionStore } from '@/stores/session'
import { ChevronRight, Plus } from 'lucide-vue-next'
import { createResource, Button } from 'frappe-ui'
import PageModal from '@/components/Modals/PageModal.vue'

const { user, sidebarSettings } = sessionStore()
const { userResource } = usersStore()
const socket = inject('$socket')
const unreadCount = ref(0)
const sidebarLinks = ref(getSidebarLinks())
const showPageModal = ref(false)
const isModerator = ref(false)
const pageToEdit = ref(null)
const showWebPages = ref(false)

onMounted(() => {
	socket.on('publish_lms_notifications', (data) => {
		unreadNotifications.reload()
	})
	addNotifications()
	sidebarSettings.reload(
		{},
		{
			onSuccess(data) {
				Object.keys(data).forEach((key) => {
					if (!parseInt(data[key])) {
						sidebarLinks.value = sidebarLinks.value.filter(
							(link) => link.label.toLowerCase().split(' ').join('_') !== key
						)
					}
				})
			},
		}
	)
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

const addNotifications = () => {
	if (user) {
		sidebarLinks.value.push({
			label: 'Notifications',
			icon: 'Bell',
			to: 'Notifications',
			activeFor: ['Notifications'],
			count: unreadCount.value,
		})
	}
}

const openPageModal = (link) => {
	showPageModal.value = true
	pageToEdit.value = link
}

const deletePage = (link) => {
	createResource({
		url: 'lms.lms.api.delete_sidebar_item',
		makeParams(values) {
			return {
				webpage: link.web_page,
			}
		},
	}).submit(
		{},
		{
			onSuccess() {
				sidebarSettings.reload()
			},
		}
	)
}

const getSidebarFromStorage = () => {
	return useStorage('sidebar_is_collapsed', false)
}

watch(userResource, () => {
	if (userResource.data) {
		isModerator.value = userResource.data.is_moderator
	}
})

let isSidebarCollapsed = ref(getSidebarFromStorage())
</script>
