<template>
	<div class="flex h-full flex-col relative">
		<div class="h-full pb-10" id="scrollContainer">
			<slot />
		</div>

		<div class="relative z-20">
			<!-- Dropdown menu -->
			<div
				class="fixed bottom-16 right-2 w-[80%] rounded-md bg-surface-white text-base p-5 space-y-4 shadow-md"
				v-if="showMenu"
				ref="menu"
			>
				<div
					v-for="link in otherLinks"
					:key="link.label"
					class="flex items-center space-x-2 cursor-pointer"
					@click="handleClick(link)"
				>
					<component
						:is="icons[link.icon]"
						class="h-4 w-4 stroke-1.5 text-ink-gray-5"
					/>
					<div>{{ link.label }}</div>
				</div>
			</div>

			<!-- Fixed menu -->
			<div
				v-if="sidebarSettings.data"
				class="fixed bottom-0 left-0 w-full flex items-center justify-around border-t border-outline-gray-2 bg-surface-white standalone:pb-4 z-10"
			>
				<button
					v-for="tab in sidebarLinks"
					:key="tab.label"
					:class="isVisible(tab) ? 'block' : 'hidden'"
					class="flex flex-col items-center justify-center py-3 transition active:scale-95"
					@click="handleClick(tab)"
				>
					<component
						:is="icons[tab.icon]"
						class="h-6 w-6 stroke-1.5"
						:class="[isActive(tab) ? 'text-ink-gray-9' : 'text-ink-gray-5']"
					/>
				</button>
				<button @click="toggleMenu">
					<component
						:is="icons['List']"
						class="h-6 w-6 stroke-1.5 text-ink-gray-5"
					/>
				</button>
			</div>
		</div>
	</div>
</template>
<script setup>
import { getSidebarLinks } from '../utils'
import { useRouter } from 'vue-router'
import { watch, ref, onMounted } from 'vue'
import { sessionStore } from '@/stores/session'
import { usersStore } from '@/stores/user'
import * as icons from 'lucide-vue-next'

const { logout, user, sidebarSettings } = sessionStore()
let { isLoggedIn } = sessionStore()
const router = useRouter()
let { userResource } = usersStore()
const sidebarLinks = ref(getSidebarLinks())
const otherLinks = ref([])
const showMenu = ref(false)
const menu = ref(null)

onMounted(() => {
	sidebarSettings.reload(
		{},
		{
			onSuccess(data) {
				filterLinksToShow(data)
				addOtherLinks()
			},
		}
	)
})

const handleOutsideClick = (e) => {
	if (menu.value && !menu.value.contains(e.target)) {
		showMenu.value = false
	}
}

watch(showMenu, (val) => {
	if (val) {
		setTimeout(() => {
			document.addEventListener('click', handleOutsideClick)
		}, 0)
	} else {
		document.removeEventListener('click', handleOutsideClick)
	}
})

const filterLinksToShow = (data) => {
	Object.keys(data).forEach((key) => {
		if (!parseInt(data[key])) {
			sidebarLinks.value = sidebarLinks.value.filter(
				(link) => link.label.toLowerCase().split(' ').join('_') !== key
			)
		}
	})
}

const addOtherLinks = () => {
	if (user) {
		otherLinks.value.push({
			label: 'Notifications',
			icon: 'Bell',
			to: 'Notifications',
		})
		otherLinks.value.push({
			label: 'Profile',
			icon: 'UserRound',
		})
		otherLinks.value.push({
			label: 'Log out',
			icon: 'LogOut',
		})
	} else {
		otherLinks.value.push({
			label: 'Log in',
			icon: 'LogIn',
		})
	}
}

watch(userResource, () => {
	if (
		userResource.data &&
		(userResource.data.is_moderator || userResource.data.is_instructor)
	) {
		addQuizzes()
		addAssignments()
	}
})

const addQuizzes = () => {
	otherLinks.value.push({
		label: 'Quizzes',
		icon: 'CircleHelp',
		to: 'Quizzes',
	})
}

const addAssignments = () => {
	otherLinks.value.push({
		label: 'Assignments',
		icon: 'Pencil',
		to: 'Assignments',
	})
}

let isActive = (tab) => {
	return tab.activeFor?.includes(router.currentRoute.value.name)
}

const handleClick = (tab) => {
	if (tab.label == 'Log in') window.location.href = '/login'
	else if (tab.label == 'Log out')
		logout.submit().then(() => {
			isLoggedIn = false
		})
	else if (tab.label == 'Profile')
		router.push({
			name: 'Profile',
			params: {
				username: userResource.data?.username,
			},
		})
	else router.push({ name: tab.to })
}

const isVisible = (tab) => {
	if (tab.label == 'Log in') return !isLoggedIn
	else if (tab.label == 'Log out') return isLoggedIn
	else return true
}

const toggleMenu = () => {
	showMenu.value = !showMenu.value
}
</script>
