<template>
	<div class="flex h-full flex-col">
		<div class="h-full pb-10" id="scrollContainer">
			<slot />
		</div>
		<div
			v-if="sidebarSettings.data"
			class="fixed flex items-center justify-around border-t border-outline-gray-2 bottom-0 z-10 w-full bg-surface-white standalone:pb-4"
			:style="{
				gridTemplateColumns: `repeat(${
					sidebarLinks.length + 1
				}, minmax(0, 1fr))`,
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
					:class="[isActive(tab) ? 'text-ink-gray-9' : 'text-ink-gray-5']"
				/>
			</button>
			<Popover
				trigger="hover"
				popoverClass="bottom-28 mx-2"
				placement="top-start"
			>
				<template #target>
					<component
						:is="icons['List']"
						class="h-6 w-6 stroke-1.5 text-ink-gray-5"
					/>
				</template>
				<template #body-main>
					<div class="text-base p-5 space-y-4">
						<div
							v-for="link in otherLinks"
							:key="link.label"
							class="flex items-center space-x-2"
							@click="handleClick(link)"
						>
							<component
								:is="icons[link.icon]"
								class="h-4 w-4 stroke-1.5 text-ink-gray-5"
							/>
							<div>
								{{ link.label }}
							</div>
						</div>
					</div>
				</template>
			</Popover>
		</div>
	</div>
</template>
<script setup>
import { getSidebarLinks } from '../utils'
import { useRouter } from 'vue-router'
import { watch, ref, onMounted } from 'vue'
import { sessionStore } from '@/stores/session'
import { usersStore } from '@/stores/user'
import { Popover } from 'frappe-ui'
import * as icons from 'lucide-vue-next'

const { logout, user, sidebarSettings } = sessionStore()
let { isLoggedIn } = sessionStore()
const router = useRouter()
let { userResource } = usersStore()
const sidebarLinks = ref(getSidebarLinks())
const otherLinks = ref([])

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

				addOtherLinks()
			},
		}
	)
})

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
	}
})

const addQuizzes = () => {
	otherLinks.value.push({
		label: 'Quizzes',
		icon: 'CircleHelp',
		to: 'Quizzes',
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
</script>
