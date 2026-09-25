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
			<router-view
				v-if="!awaitingEmail"
				:profile="profile"
				:key="profile.data?.username"
			/>
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
import PageHeader from '@/components/Layouts/PageHeader.vue'
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

// get_profile_details sends another user's email to no one. The moderator-only
// tabs (Roles, Slots, Schedule) act on it, so a moderator reads it from User
// under their own DocPerms, and the tabs wait for it.
const resolvedEmail = ref(null)

const applyResolvedEmail = () => {
	const data = profile.data
	if (data && !data.name && resolvedEmail.value?.username === data.username)
		data.name = resolvedEmail.value.name
}

// A lookup can outlive a navigation to another profile, so each response is
// bound to the username it asked about and dropped once that profile is gone.
const settleEmail = (username, name) => {
	if (username !== profile.data?.username) return
	resolvedEmail.value = { username, name }
	applyResolvedEmail()
}

const profileEmail = createResource({ url: 'frappe.client.get_value' })

const awaitingEmail = computed(
	() =>
		Boolean($user.data?.is_moderator) &&
		Boolean(profile.data) &&
		!profile.data.name &&
		resolvedEmail.value?.username !== profile.data.username
)

watch(
	() => awaitingEmail.value && profile.data?.username,
	(username) => {
		if (!username) return
		profileEmail.submit(
			{ doctype: 'User', filters: { username }, fieldname: 'name' },
			{
				onSuccess: (data) => settleEmail(username, data?.name || null),
				onError: () => settleEmail(username, null),
			}
		)
	},
	{ immediate: true }
)

watch(() => profile.data, applyResolvedEmail)

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
	return (
		Boolean(profile.data?.username) &&
		$user.data?.username === profile.data?.username
	)
}

// Another evaluator's slots and schedule are keyed on their email, which only a
// moderator is sent; the endpoints refuse anyone else anyway.
const canSeeEvaluatorTabs = () => {
	if ($user.data?.is_moderator) return true
	return $user.data?.is_evaluator && isSessionUser()
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

	if (canSeeEvaluatorTabs() && isEvaluatorOrModerator()) {
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
