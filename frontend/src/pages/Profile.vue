<template>
	<NoPermission v-if="!$user.data" />
	<div v-else-if="profile.data">
		<header
			class="sticky top-0 z-10 flex flex-col md:flex-row md:items-center justify-between border-b bg-surface-white px-3 py-2.5 sm:px-5"
		>
			<Breadcrumbs class="h-7" :items="breadcrumbs" />
		</header>
		<div class="group relative h-[130px] w-full">
			<img
				v-if="profile.data.cover_image"
				:src="profile.data.cover_image"
				class="h-[130px] w-full object-cover object-center"
			/>
			<div
				v-else
				:class="{ 'bg-surface-gray-2': !profile.data.cover_image }"
				class="h-[130px] w-full"
			></div>
			<div
				class="absolute bottom-0 left-1/2 mb-4 flex -translate-x-1/2 space-x-2 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100"
				v-if="isSessionUser()"
			>
				<EditCoverImage
					@select="(imageUrl) => coverImage.submit({ url: imageUrl })"
				>
					<template v-slot="{ togglePopover }">
						<Button
							v-if="!readOnlyMode"
							variant="outline"
							@click="togglePopover()"
						>
							<template #prefix>
								<Edit class="w-4 h-4 stroke-1.5 text-ink-gray-7" />
							</template>
							{{ __('Edit') }}
						</Button>
					</template>
				</EditCoverImage>
			</div>
		</div>
		<div class="mx-auto -mt-10 md:-mt-4 max-w-4xl translate-x-0 px-5">
			<div class="flex flex-col md:flex-row items-center">
				<div>
					<img
						v-if="profile.data.user_image"
						:src="profile.data.user_image"
						class="object-cover h-[100px] w-[100px] rounded-full border-4 border-white object-cover"
					/>
					<UserAvatar
						v-else
						:user="profile.data"
						class="object-cover h-[100px] w-[100px] rounded-full border-4 border-white object-cover"
					/>
				</div>
				<div class="ml-6">
					<h2 class="mt-2 text-3xl font-semibold text-ink-gray-9">
						{{ profile.data.full_name }}
					</h2>
					<div class="mt-2 text-base text-ink-gray-7">
						{{ profile.data.headline }}
					</div>
				</div>
				<Button
					v-if="isSessionUser() && !readOnlyMode"
					class="mt-3 sm:mt-0 md:ml-auto"
					@click="editProfile()"
				>
					<template #prefix>
						<Edit class="w-4 h-4 stroke-1.5 text-ink-gray-7" />
					</template>
					{{ __('Edit Profile') }}
				</Button>
			</div>

			<div class="mb-4 mt-6">
				<TabButtons
					class="inline-block"
					:buttons="getTabButtons()"
					v-model="activeTab"
				/>
			</div>
			<router-view :profile="profile" />
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
	Breadcrumbs,
	createResource,
	Button,
	TabButtons,
	usePageMeta,
} from 'frappe-ui'
import { computed, inject, watch, ref, onMounted, watchEffect } from 'vue'
import { sessionStore } from '@/stores/session'
import { Edit } from 'lucide-vue-next'
import UserAvatar from '@/components/UserAvatar.vue'
import { useRoute, useRouter } from 'vue-router'
import NoPermission from '@/components/NoPermission.vue'
import { convertToTitleCase } from '@/utils'
import EditProfile from '@/components/Modals/EditProfile.vue'
import EditCoverImage from '@/components/Modals/EditCoverImage.vue'

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
	url: 'frappe.client.get',
	makeParams(values) {
		return {
			doctype: 'User',
			filters: {
				username: props.username,
			},
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
	return $user.data?.email === profile.data?.email
}

const getTabButtons = () => {
	let buttons = [{ label: 'About' }, { label: 'Certificates' }]
	if ($user.data?.is_moderator) buttons.push({ label: 'Roles' })
	if (
		isSessionUser() &&
		($user.data?.is_evaluator || $user.data?.is_moderator)
	) {
		buttons.push({ label: 'Slots' })
		buttons.push({ label: 'Schedule' })
	}

	return buttons
}

const breadcrumbs = computed(() => {
	let crumbs = [
		{
			label: 'People',
		},
		{
			label: profile.data?.full_name,
			route: {
				name: 'Profile',
				params: {
					username: user.doc?.username,
				},
			},
		},
	]
	return crumbs
})

usePageMeta(() => {
	return {
		title: profile.data?.full_name,
		icon: brand.favicon,
	}
})
</script>
