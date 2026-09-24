<template>
	<NoPermission v-if="!$user.data" />
	<div v-else-if="profile.data">
		<PageHeader :breadcrumbs="breadcrumbs">
			<template #actions>
				<HeaderButton
					v-if="isSessionUser()"
					variant="ghost"
					:label="__('Refresh session')"
					icon="lucide-refresh-ccw"
					@click="reloadUser()"
				/>
			</template>
		</PageHeader>
		<ProfileCover
			:cover-image="profile.data.cover_image"
			:is-session-user="isSessionUser()"
			:read-only="readOnlyMode"
			@select="(imageUrl) => coverImage.submit({ url: imageUrl })"
		/>
		<div class="mx-auto -mt-10 md:-mt-4 max-w-4xl translate-x-0 px-5">
			<div class="flex flex-col md:flex-row items-center">
				<div>
					<ProfileAvatar
						:image="profile.data.user_image"
						:full-name="profile.data.full_name"
						:open-to="profile.data.open_to"
					/>
				</div>
				<div class="ms-6 mt-5">
					<h1 class="text-4xl-semibold text-ink-gray-9">
						{{ profile.data.full_name }}
					</h1>
					<div class="text-base text-ink-gray-7 mt-1">
						{{ profile.data.headline }}
					</div>
					<ProfileSocialLinks
						:twitter="profile.data.twitter"
						:linkedin="profile.data.linkedin"
						:github="profile.data.github"
					/>
				</div>
				<Button
					v-if="isSessionUser() && !readOnlyMode"
					class="mt-3 sm:mt-0 md:ms-auto"
					@click="editProfile()"
				>
					<template #prefix>
						<span class="lucide-edit size-4 text-ink-gray-7" />
					</template>
					{{ __('Edit Profile') }}
				</Button>
			</div>

			<div class="mb-4 mt-10">
				<TabButtons
					:fluid="isMobile"
					:options="getTabButtons()"
					v-model="activeTab"
				/>
			</div>
			<router-view :profile="profile" :key="profile.data.name" />
		</div>
	</div>
	<NotFound v-else-if="(profile.fetched || profile.error) && !profile.data" />
</template>
<script setup>
import {
	Button,
	call,
	createResource,
	TabButtons,
	toast,
	usePageMeta,
} from 'frappe-ui'
import { computed, inject, watch, ref, onMounted, watchEffect } from 'vue'
import PageHeader from '@/components/Layouts/pages/PageHeader.vue'
import HeaderButton from '@/components/HeaderButton.vue'
import { sessionStore } from '@/stores/session'
import { useRoute, useRouter } from 'vue-router'
import { convertToTitleCase } from '@/utils'
import { useScreenSize } from '@/utils/composables'
import UserAvatar from '@/components/UserAvatar.vue'
import NoPermission from '@/components/NoPermission.vue'
import NotFound from '@/pages/NotFound.vue'
import ProfileAvatar from '@/components/Profile/ProfileAvatar.vue'
import ProfileCover from '@/components/Profile/ProfileCover.vue'
import ProfileSocialLinks from '@/components/Profile/ProfileSocialLinks.vue'
import { openFormRoute } from '@/composables/useFormRoute'

const { user, brand } = sessionStore()
const $user = inject('$user')
const route = useRoute()
const router = useRouter()
const activeTab = ref('')
const readOnlyMode = window.read_only_mode
const { isMobile } = useScreenSize()

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

// The edit form is a child route, not a tab, and `edit` matches none of the tab
// segments — so setActiveTab lands on About and this effect would push the About
// tab straight over a deep link to the form before it ever renders.
watchEffect(() => {
	if (!activeTab.value || route.name === 'ProfileEditForm') return
	let target = {
		About: { name: 'ProfileAbout' },
		Certificates: { name: 'ProfileCertificates' },
		Roles: { name: 'ProfileRoles' },
		Slots: { name: 'ProfileEvaluator' },
		Schedule: { name: 'ProfileEvaluationSchedule' },
	}[activeTab.value]
	// `route.name` is read through the router's current-route ref, so this effect
	// re-runs on every navigation, a hash-only one included, and a bare {name}
	// push carries no hash. That took '#settings/<slug>' straight back off the
	// URL, so settings never opened on this page.
	if (!target || route.name === target.name) return
	router.push(target)
})

watch(
	() => props.username,
	() => {
		profile.reload()
	}
)

const editProfile = () => {
	openFormRoute(router, {
		name: 'ProfileEditForm',
		params: { username: props.username },
	})
}

const isSessionUser = () => {
	return $user.data?.name === profile.data?.name
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
	let buttons = [
		{ label: __('About'), value: 'About' },
		{ label: __('Certificates'), value: 'Certificates' },
	]
	if ($user.data?.is_moderator) {
		buttons.push({ label: __('Roles'), value: 'Roles' })
	}

	if (currentUserHasHigherAccess() && isEvaluatorOrModerator()) {
		buttons.push({ label: __('Slots'), value: 'Slots' })
		buttons.push({ label: __('Schedule'), value: 'Schedule' })
	}
	return buttons
}

const reloadUser = () => {
	call('frappe.sessions.clear')
		.then(() => {
			$user.reload().then(() => {
				profile.reload()
				toast.success(__('Session refreshed successfully'))
			})
		})
		.catch((err) => {
			toast.error(__('Failed to refresh session'))
			console.error(err)
		})
}

const breadcrumbs = computed(() => {
	let crumbs = [
		{
			label: __('People'),
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
