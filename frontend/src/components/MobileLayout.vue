<template>
	<div class="flex h-full flex-col">
		<div class="h-full pb-10" id="scrollContainer">
			<slot />
		</div>
		<div
			v-if="sidebarSettings.data"
			class="fixed flex justify-around border-t border-gray-300 bottom-0 z-10 w-full bg-white standalone:pb-4"
			:style="{
				gridTemplateColumns: `repeat(${sidebarLinks.length}, minmax(0, 1fr))`,
			}"
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
					:class="[isActive(tab) ? 'text-gray-900' : 'text-gray-600']"
				/>
			</button>
		</div>
	</div>
</template>
<script setup>
import { getSidebarLinks } from '../utils'
import { useRouter } from 'vue-router'
import { computed, ref, onMounted } from 'vue'
import { sessionStore } from '@/stores/session'
import { usersStore } from '@/stores/user'
import * as icons from 'lucide-vue-next'

const { logout, user, sidebarSettings } = sessionStore()
let { isLoggedIn } = sessionStore()
const router = useRouter()
let { userResource } = usersStore()
const sidebarLinks = ref(getSidebarLinks())

onMounted(() => {
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
				addAccessLinks()
			},
		}
	)
})

const addAccessLinks = () => {
	if (user) {
		sidebarLinks.value.push({
			label: 'Profile',
			icon: 'UserRound',
			activeFor: [
				'Profile',
				'ProfileAbout',
				'ProfileCertification',
				'ProfileEvaluator',
				'ProfileRoles',
			],
		})
		sidebarLinks.value.push({
			label: 'Log out',
			icon: 'LogOut',
		})
	} else {
		sidebarLinks.value.push({
			label: 'Log in',
			icon: 'LogIn',
		})
	}
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
</script>
