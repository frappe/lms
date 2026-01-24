<template>
	<div class="flex h-full flex-col relative">
		<div class="relative z-20">
			<div
				class="fixed top-16 right-4 w-[280px] rounded bg-surface-white text-base py-3 border border-gray-100 shadow-xl z-50 overflow-hidden"
				v-if="showMenu"
				ref="menu"
			>
				<div class="flex flex-col px-2 gap-1">
					<div
						v-for="link in allLinks"
						:key="link.label"
						class="flex items-center space-x-3 cursor-pointer p-3 rounded-xl transition-colors"
						:class="
							isActive(link)
								? 'bg-surface-selected text-ink-gray-9'
								: 'hover:bg-gray-50 text-ink-gray-6'
						"
						@click="handleClick(link)"
					>
						<component
							:is="allIcons[link.icon] || allIcons['Circle']"
							class="h-5 w-5 stroke-1.5"
						/>
						<div class="font-medium text-sm">{{ __(link.label) }}</div>
					</div>

					<div class="h-px bg-gray-100 my-2 mx-1"></div>

					<div
						class="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-widest"
					>
						{{ __('Profile') }}
					</div>

					<div
						v-for="link in accountLinks"
						:key="link.label"
						class="flex items-center space-x-3 cursor-pointer p-3 rounded-xl transition-colors group"
						:class="
							link.label === 'Log out'
								? 'hover:bg-red-50 text-red-600'
								: 'hover:bg-gray-50 text-gray-900 font-medium'
						"
						@click="handleClick(link)"
					>
						<component
							:is="allIcons[link.icon]"
							class="h-5 w-5 stroke-[1.5px]"
							:class="
								link.label === 'Log out' ? 'text-red-500' : 'text-gray-900'
							"
						/>
						<div class="text-sm">{{ __(link.label) }}</div>
					</div>
				</div>
			</div>

			<div
				v-if="sidebarSettings.data"
				class="fixed top-0 left-0 w-full h-16 px-4 flex items-center justify-between border-b border-gray-100 bg-surface-white standalone:pb-4 z-20"
			>
				<div class="flex items-center gap-x-2">
					<UnairLogo class="h-8" />
					<LMSLogoFull class="h-10 flex-shrink-0" />
				</div>
				<div class="flex items-center gap-x-1">
					<NotificationPopover placement="bottom-end" />
					<button @click="toggleMenu" class="pl-1 pr-4 py-2">
						<component
							:is="icons['Menu']"
							class="h-6 w-6 stroke-1.5 text-gray-900"
						/>
					</button>
				</div>
			</div>
		</div>
		<div class="h-full pt-16" id="scrollContainer">
			<slot />
		</div>
	</div>
</template>
<script setup>
import { getSidebarLinks } from '@/utils'
import { useRouter } from 'vue-router'
import { call } from 'frappe-ui'
import { watch, ref, onMounted, computed } from 'vue'
import { sessionStore } from '@/stores/session'
import { useSettings } from '@/stores/settings'
import { usersStore } from '@/stores/user'
import * as icons from 'lucide-vue-next'
import LMSLogoFull from '@/components/Icons/LMSLogoFull.vue'
import UnairLogo from '@/components/Icons/UnairLogo.vue'
import NotificationPopover from '@/components/NotificationPopover.vue'
import BatchesIcon from '@/components/Icons/BatchesIcon.vue'
import StatisticsIcon from '@/components/Icons/StatisticsIcon.vue'
import CircleProfileIcon from '@/components/Icons/CircleProfileIcon.vue'
import LogoutIcon from '@/components/Icons/LogoutIcon.vue'
import HomeIcon from '@/components/Icons/HomeIcon.vue'
import CoursesIcon from '@/components/Icons/CoursesIcon.vue'

const allIcons = {
	...icons,
	HomeIcon,
	CoursesIcon,
	BatchesIcon,
	StatisticsIcon,
	CircleProfileIcon,
	LogoutIcon,
}

const { logout, user } = sessionStore()
let { isLoggedIn } = sessionStore()
const { sidebarSettings } = useSettings()
const router = useRouter()
let { userResource } = usersStore()
const sidebarLinks = ref(getSidebarLinks())
const accountLinks = ref([])
const showMenu = ref(false)
const menu = ref(null)
const isModerator = ref(false)
const isInstructor = ref(false)

onMounted(() => {
	setSidebarLinks()
})

const setSidebarLinks = () => {
	sidebarSettings.reload(
		{},
		{
			onSuccess(data) {
				Object.keys(data).forEach((key) => {
					if (!parseInt(data[key])) {
						sidebarLinks.value = sidebarLinks.value.filter(
							(link) => link.label.toLowerCase().split(' ').join('_') !== key,
						)
					}
				})
				addAccountLinks()
			},
		},
	)
}

const addAccountLinks = () => {
	accountLinks.value = []
	if (user) {
		accountLinks.value.push({
			label: 'My Profile',
			icon: 'CircleProfileIcon',
			to: 'Profile',
		})
		accountLinks.value.push({
			label: 'Log out',
			icon: 'LogoutIcon',
		})
	} else {
		accountLinks.value.push({
			label: 'Log in',
			icon: 'LogIn',
		})
	}
}

const allLinks = computed(() => {
	return sidebarLinks.value
})

watch(userResource, () => {
	addContactUsDetails()
	if (userResource.data) {
		isModerator.value = userResource.data.is_moderator
		isInstructor.value = userResource.data.is_instructor
		addHome()
		addQuizzes()
		addAssignments()
		addProgrammingExercises()
	}
})

const addContactUsDetails = () => {
	const settingsStore = useSettings()
	if (!settingsStore.contactUsEmail?.data && !settingsStore.contactUsURL?.data)
		return

	const exists = sidebarLinks.value.some((link) => link.label === 'Contact Us')
	if (exists) return

	sidebarLinks.value.push({
		label: 'Contact Us',
		icon: settingsStore.contactUsURL?.data ? 'Headset' : 'Mail',
		to: settingsStore.contactUsURL?.data
			? settingsStore.contactUsURL.data
			: settingsStore.contactUsEmail?.data,
	})
}

const addQuizzes = () => {
	if (!isInstructor.value && !isModerator.value) return
	const exists = sidebarLinks.value.some((link) => link.label === 'Quizzes')
	if (exists) return
	sidebarLinks.value.splice(4, 0, {
		label: 'Quizzes',
		icon: 'CircleHelp',
		to: 'Quizzes',
		activeFor: ['Quizzes', 'QuizForm', 'QuizSubmissionList', 'QuizSubmission'],
	})
}

const addAssignments = () => {
	if (!isInstructor.value && !isModerator.value) return
	const exists = sidebarLinks.value.some((link) => link.label === 'Assignments')
	if (exists) return
	sidebarLinks.value.splice(5, 0, {
		label: 'Assignments',
		icon: 'Pencil',
		to: 'Assignments',
		activeFor: [
			'Assignments',
			'AssignmentForm',
			'AssignmentSubmissionList',
			'AssignmentSubmission',
		],
	})
}

const addProgrammingExercises = () => {
	if (!isInstructor.value && !isModerator.value) return
	const exists = sidebarLinks.value.some(
		(link) => link.label === 'Programming Exercises',
	)
	if (exists) return
	sidebarLinks.value.splice(3, 0, {
		label: 'Programming Exercises',
		icon: 'Code',
		to: 'ProgrammingExercises',
		activeFor: [
			'ProgrammingExercises',
			'ProgrammingExerciseForm',
			'ProgrammingExerciseSubmissions',
			'ProgrammingExerciseSubmission',
		],
	})
}

const addHome = () => {
	const exists = sidebarLinks.value.some((link) => link.label === 'Home')
	if (exists) return
	sidebarLinks.value.unshift({
		label: 'Home',
		icon: 'HomeIcon',
		to: 'Home',
		activeFor: ['Home'],
	})
}

const checkIfCanAddProgram = async () => {
	if (isModerator.value || isInstructor.value) {
		return true
	}
	const programs = await call('lms.lms.utils.get_programs')
	return programs.enrolled.length > 0 || programs.published.length > 0
}

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

let isActive = (tab) => {
	return tab.activeFor?.includes(router.currentRoute.value.name)
}

const handleClick = (tab) => {
	if (tab.label == 'Log in') window.location.href = '/login'
	else if (tab.label == 'Log out')
		logout.submit().then(() => {
			isLoggedIn = false
		})
	else if (tab.label == 'My Profile' || tab.label == 'Profile')
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
