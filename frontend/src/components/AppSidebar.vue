<template>
	<div
		class="flex h-full flex-col justify-between transition-all duration-300 ease-in-out border-r bg-surface-menu-bar"
		:class="sidebarStore.isSidebarCollapsed ? 'w-14' : 'w-56'"
	>
		<div
			class="flex flex-col overflow-hidden"
			:class="sidebarStore.isSidebarCollapsed ? 'items-center' : ''"
		>
			<UserDropdown :isCollapsed="sidebarStore.isSidebarCollapsed" />
			<div class="flex flex-col" v-if="sidebarSettings.data">
				<SidebarLink
					v-for="link in sidebarLinks"
					:link="link"
					:isCollapsed="sidebarStore.isSidebarCollapsed"
					class="mx-2 my-0.5"
				/>
			</div>
			<div
				v-if="sidebarSettings.data?.web_pages?.length || isModerator"
				class="mt-4"
			>
				<div
					class="flex items-center justify-between pr-2 cursor-pointer"
					:class="sidebarStore.isSidebarCollapsed ? 'pl-3' : 'pl-4'"
					@click="toggleWebPages"
				>
					<div
						v-if="!sidebarStore.isSidebarCollapsed"
						class="flex items-center text-sm text-ink-gray-5 my-1"
					>
						<span class="grid h-5 w-6 flex-shrink-0 place-items-center">
							<ChevronRight
								class="h-4 w-4 stroke-1.5 text-ink-gray-9 transition-all duration-300 ease-in-out"
								:class="{ 'rotate-90': !sidebarStore.isWebpagesCollapsed }"
							/>
						</span>
						<span class="ml-2">
							{{ __('More') }}
						</span>
					</div>
					<Button v-if="isModerator" variant="ghost" @click="openPageModal()">
						<template #icon>
							<Plus class="h-4 w-4 text-ink-gray-7 stroke-1.5" />
						</template>
					</Button>
				</div>
				<div
					v-if="sidebarSettings.data?.web_pages?.length"
					class="flex flex-col transition-all duration-300 ease-in-out"
					:class="!sidebarStore.isWebpagesCollapsed ? 'block' : 'hidden'"
				>
					<SidebarLink
						v-for="link in sidebarSettings.data.web_pages"
						:link="link"
						:isCollapsed="sidebarStore.isSidebarCollapsed"
						class="mx-2 my-0.5"
						:showControls="isModerator ? true : false"
						@openModal="openPageModal"
						@deletePage="deletePage"
					/>
				</div>
			</div>
		</div>
		<div>
			<TrialBanner
				v-if="
					userResource.data?.user_type == 'System User' &&
					userResource.data?.is_fc_site
				"
				:isSidebarCollapsed="sidebarStore.isSidebarCollapsed"
			/>
			<SidebarLink
				:link="{
					label: sidebarStore.isSidebarCollapsed ? 'Expand' : 'Collapse',
				}"
				:isCollapsed="sidebarStore.isSidebarCollapsed"
				@click="toggleSidebar()"
				class="m-2"
			>
				<template #icon>
					<span class="grid h-5 w-6 flex-shrink-0 place-items-center">
						<CollapseSidebar
							class="h-4.5 w-4.5 text-ink-gray-7 duration-300 ease-in-out"
							:class="{
								'[transform:rotateY(180deg)]': sidebarStore.isSidebarCollapsed,
							}"
						/>
					</span>
				</template>
			</SidebarLink>
		</div>
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
import { useSidebar } from '@/stores/sidebar'
import { useSettings } from '@/stores/settings'
import { ChevronRight, Plus } from 'lucide-vue-next'
import { Button, createResource, TrialBanner } from 'frappe-ui'
import PageModal from '@/components/Modals/PageModal.vue'

const { user, sidebarSettings } = sessionStore()
const { userResource } = usersStore()
let sidebarStore = useSidebar()
const socket = inject('$socket')
const unreadCount = ref(0)
const sidebarLinks = ref(getSidebarLinks())
const showPageModal = ref(false)
const isModerator = ref(false)
const isInstructor = ref(false)
const pageToEdit = ref(null)
const settingsStore = useSettings()

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

const addQuizzes = () => {
	if (isInstructor.value || isModerator.value) {
		sidebarLinks.value.push({
			label: 'Quizzes',
			icon: 'CircleHelp',
			to: 'Quizzes',
			activeFor: ['Quizzes', 'QuizForm'],
		})
	}
}

const addAssignments = () => {
	if (isInstructor.value || isModerator.value) {
		sidebarLinks.value.push({
			label: 'Assignments',
			icon: 'Pencil',
			to: 'Assignments',
			activeFor: ['Assignments', 'AssignmentForm'],
		})
	}
}

const addPrograms = () => {
	let activeFor = ['Programs', 'ProgramForm']
	let index = 1
	let canAddProgram = false

	if (
		!isInstructor.value &&
		!isModerator.value &&
		settingsStore.learningPaths.data
	) {
		sidebarLinks.value = sidebarLinks.value.filter(
			(link) => link.label !== 'Courses'
		)
		activeFor.push('CourseDetail')
		activeFor.push('Lesson')
		index = 0
		canAddProgram = true
	} else if (isInstructor.value || isModerator.value) {
		canAddProgram = true
	}

	if (canAddProgram) {
		sidebarLinks.value.splice(index, 0, {
			label: 'Programs',
			icon: 'Route',
			to: 'Programs',
			activeFor: activeFor,
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
		isInstructor.value = userResource.data.is_instructor
		addPrograms()
		addQuizzes()
		addAssignments()
	}
})

const toggleSidebar = () => {
	sidebarStore.isSidebarCollapsed = !sidebarStore.isSidebarCollapsed
	localStorage.setItem(
		'isSidebarCollapsed',
		JSON.stringify(sidebarStore.isSidebarCollapsed)
	)
}

const toggleWebPages = () => {
	sidebarStore.isWebpagesCollapsed = !sidebarStore.isWebpagesCollapsed
	localStorage.setItem(
		'isWebpagesCollapsed',
		JSON.stringify(sidebarStore.isWebpagesCollapsed)
	)
}
</script>
