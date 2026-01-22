<template>
	<NoPermission v-if="!$user.data" />
	<div v-else-if="profile.data" class="min-h-screen bg-gray-50 pb-12">
		<div class="group relative h-48 w-full bg-gradient-to-r from-[#125CA2] to-[#51E3B2]">
			<img
				v-if="profile.data.cover_image"
				:src="profile.data.cover_image"
				class="h-full w-full object-cover object-center"
			/>
			<div
				class="absolute top-4 right-4"
				v-if="isSessionUser()"
			>
				<EditCoverImage
					@select="(imageUrl) => coverImage.submit({ url: imageUrl })"
				>
					<template v-slot="{ togglePopover }">
						<button
							v-if="!readOnlyMode"
							class="flex items-center space-x-2 rounded bg-white/20 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-sm hover:bg-white/30 transition-colors"
							@click="togglePopover()"
						>
							<Edit class="h-4 w-4" />
							<span>{{ __('Change image') }}</span>
						</button>
					</template>
				</EditCoverImage>
			</div>
		</div>

		<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
			<div
				class="relative -mt-12 rounded-xl bg-white p-6 border border-gray-100 sm:p-8"
			>
				<div
					class="flex flex-col items-center sm:flex-row sm:items-start sm:space-x-8"
				>
					<div class="relative">
						<img
							v-if="profile.data.user_image"
							:src="profile.data.user_image"
							class="h-24 w-24 rounded-full border-4 border-white object-cover shadow-sm bg-gray-100"
						/>
						<UserAvatar
							v-else
							:user="profile.data"
							class="h-24 w-24 rounded-full border-4 border-white object-cover shadow-sm"
						/>
					</div>

					<div class="mt-4 text-center sm:mt-8 sm:text-left flex-1">
						<div
							class="flex flex-col sm:flex-row sm:items-center sm:justify-between"
						>
							<div>
								<h1
									class="flex items-center justify-center gap-2 text-2xl font-bold text-gray-900 sm:justify-start"
								>
									{{ profile.data.full_name }}
									<button
										v-if="isSessionUser() && !readOnlyMode"
										@click="editProfile()"
										class="text-[#00C49F] hover:text-[#00a082]"
									>
										<Edit class="h-5 w-5" />
									</button>
								</h1>
								<p class="mt-1 text-base text-gray-500">
									{{ profile.data.headline || 'Learning Enthusiast' }}
								</p>
							</div>
						</div>
					</div>
				</div>
			</div>

			<div
				class="mt-8 flex flex-col overflow-hidden rounded-xl bg-white border border-gray-100 lg:flex-row min-h-[300px]"
			>
				<div class="w-full border-r border-gray-100 lg:w-64 flex-shrink-0">
					<nav class="flex flex-col">
						<div
							v-for="tab in getTabButtons()"
							:key="tab.label"
							@click="activeTab = tab.label"
							:class="[
								activeTab === tab.label
									? 'bg-[#E6FFFA] text-[#00C49F]'
									: 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
								'group flex items-center px-6 py-4 text-sm font-medium cursor-pointer transition-colors !border-b border-gray-100 lg:border-b-0',
							]"
						>
							<span class="truncate">{{ tab.label }}</span>
						</div>
					</nav>
				</div>

				<div class="flex-1 min-h-[400px]">
					<div class="h-full">
						<div
							v-if="activeTab === 'About' && !profile.data.bio"
							class="flex h-full flex-col items-center justify-center text-center p-8"
						>
							<EmptyIcon class="mb-4 text-gray-300" />
							<h3 class="mt-2 text-lg font-semibold text-gray-900">
								Nothing to see here yet
							</h3>
							<p class="mt-1 max-w-sm text-sm text-gray-500">
								Your learning updates will show up here soon
							</p>
							<div class="mt-6">
								<Button
									v-if="isSessionUser() && !readOnlyMode"
									variant="solid"
									class="!bg-[#00C49F] hover:!bg-[#00a082] text-white"
									@click="editProfile()"
								>
									{{ __('Add Bio') }}
								</Button>
							</div>
						</div>

						<div v-else class="p-6 lg:p-8">
							<router-view
								:profile="profile"
								:key="profile.data?.name"
							/>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>

	<EditProfile
		v-model="showProfileModal"
		v-model:reloadProfile="profile"
		:profile="profile"
	/>
</template>

<script setup>
import {
	Button,
	call,
	createResource,
	usePageMeta,
} from 'frappe-ui'
import { inject, watch, ref, onMounted, watchEffect } from 'vue'
import { sessionStore } from '@/stores/session'
import { Edit } from 'lucide-vue-next'
import { useRoute, useRouter } from 'vue-router'
import { convertToTitleCase } from '@/utils'
import UserAvatar from '@/components/UserAvatar.vue'
import NoPermission from '@/components/NoPermission.vue'
import EditProfile from '@/components/Modals/EditProfile.vue'
import EditCoverImage from '@/components/Modals/EditCoverImage.vue'
import EmptyIcon from '@/components/Icons/EmptyIcon.vue'

const { user, brand } = sessionStore()
const $user = inject('$user')
const route = useRoute()
const router = useRouter()
const activeTab = ref('')
const showProfileModal = ref(false)
const readOnlyMode = window.read_only_mode

const props = defineProps({
	username: {
		type: String,
		required: true,
	},
})

onMounted(() => {
	if ($user.data) profile.reload()
	setActiveTab()
})

const profile = createResource({
	url: 'lms.lms.api.get_profile_details',
	makeParams() {
		return {
			username: props.username,
		}
	},
})

const coverImage = createResource({
	url: 'frappe.client.set_value',
	makeParams(values) {
		return {
			doctype: 'User',
			name: profile.data?.name,
			fieldname: 'cover_image',
			value: values.url,
		}
	},
	onSuccess() {
		profile.reload()
	},
})

const setActiveTab = () => {
	let fragments = route.path.split('/')
	let sections = ['certificates', 'roles', 'slots', 'schedule']
	sections.forEach((section) => {
		if (fragments.includes(section)) {
			activeTab.value = convertToTitleCase(section)
		}
	})
	if (!activeTab.value) activeTab.value = 'About'
}

watchEffect(() => {
	if (activeTab.value) {
		let route = {
			About: { name: 'ProfileAbout' },
			Certificates: { name: 'ProfileCertificates' },
			Roles: { name: 'ProfileRoles' },
			Slots: { name: 'ProfileEvaluator' },
			Schedule: { name: 'ProfileEvaluationSchedule' },
		}[activeTab.value]
		router.push(route)
	}
})

watch(
	() => props.username,
	() => {
		profile.reload()
	}
)

const editProfile = () => {
	showProfileModal.value = true
}

const isSessionUser = () => {
	return $user.data?.email === profile.data?.name
}

const currentUserHasHigherAccess = () => {
	return $user.data?.is_evaluator || $user.data?.is_moderator
}

const isEvaluatorOrModerator = () => {
	return (
		profile.data?.roles?.includes('Batch Evaluator') ||
		profile.data?.roles?.includes('Moderator')
	)
}

const getTabButtons = () => {
	let buttons = [{ label: 'About' }, { label: 'Certificates' }]
	if ($user.data?.is_moderator) buttons.push({ label: 'Roles' })

	if (currentUserHasHigherAccess() && isEvaluatorOrModerator()) {
		buttons.push({ label: 'Slots' })
		buttons.push({ label: 'Schedule' })
	}
	return buttons
}

usePageMeta(() => {
	return {
		title: profile.data?.full_name,
		icon: brand.favicon,
	}
})
</script>
