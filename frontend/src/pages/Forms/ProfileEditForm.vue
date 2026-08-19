<template>
	<FormShell :title="__('Edit Profile')" @close="close">
		<template #header-action>
			<Badge v-if="isDirty" theme="orange">
				{{ __('Not Saved') }}
			</Badge>
		</template>
		<template #default>
			<div v-if="refusal" class="p-4 text-base text-ink-gray-6">
				{{ refusal }}
			</div>
			<div v-else-if="!profileData" class="p-4 text-base text-ink-gray-6">
				{{ __('Loading...') }}
			</div>
			<div
				v-else
				data-testid="profile-fields"
				class="grid grid-cols-1 gap-6 text-base md:grid-cols-2 md:gap-10"
			>
				<div class="space-y-4">
					<Uploader
						v-model="profile.image"
						:label="__('Profile Image')"
						shape="circle"
					/>
					<FormControl
						v-model="profile.first_name"
						:label="__('First Name')"
						:required="true"
					/>
					<FormControl v-model="profile.last_name" :label="__('Last Name')" />
					<FormControl v-model="profile.headline" :label="__('Headline')" />
					<FormControl v-model="profile.linkedin" :label="__('LinkedIn ID')" />
					<FormControl v-model="profile.github" :label="__('GitHub ID')" />
					<FormControl v-model="profile.twitter" :label="__('Twitter ID')" />
				</div>
				<div class="space-y-4">
					<FormControl
						v-model="profile.open_to"
						type="select"
						:options="[' ', 'Work', 'Hiring']"
						:label="__('Open to')"
						:placeholder="__('Looking for new work or hiring talent?')"
					/>
					<Link
						:label="__('Language')"
						v-model="profile.language"
						doctype="Language"
					/>
					<div>
						<div class="mb-1.5 text-p-sm-medium text-ink-gray-7">
							{{ __('Bio') }}
						</div>
						<RichTextEditor
							:fixedMenu="true"
							@change="(val) => (profile.bio = val)"
							:content="profile.bio"
							editorClass="prose-sm py-2 px-2 min-h-[280px] border-outline-gray-2 hover:border-outline-gray-3 rounded-b-md bg-surface-gray-3"
						/>
					</div>
				</div>
			</div>
		</template>
		<template #actions>
			<div v-if="!refusal && profileData" class="flex items-center justify-end">
				<HeaderButton
					data-testid="profile-save"
					:label="__('Save')"
					variant="solid"
					:loading="updateProfile.loading"
					@click="saveProfile()"
				/>
			</div>
		</template>
	</FormShell>
</template>
<script setup>
import { Badge, createResource, FormControl, toast } from 'frappe-ui'
import { computed, inject, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { sanitizeOnWrite } from '@/utils/sanitizeOnWrite'
import FormShell from '@/components/FormShell.vue'
import HeaderButton from '@/components/HeaderButton.vue'
import Link from '@/components/Controls/Link.vue'
import Uploader from '@/components/Controls/Uploader.vue'
import RichTextEditor from '@/components/RichTextEditor.vue'
import { useFormRoute } from '@/composables/useFormRoute'
import { submitResource } from '@/utils/resource'

const props = defineProps({
	username: {
		type: String,
		required: true,
	},
	// Handed down by Profile.vue's router-view, which is the only thing that can
	// mount this route — the profile fetch is the parent's, not ours. Optional so
	// a missing binding degrades to the "Loading..." branch instead of throwing;
	// saving is blocked there too, or an empty form would post over a real user.
	profile: {
		type: Object,
		default: null,
	},
})

const user = inject('$user')
const router = useRouter()
const readOnlyMode = window.read_only_mode
const isDirty = ref(false)

const parent = {
	name: 'ProfileAbout',
	params: { username: props.username },
}
const { close, saveAndReplace } = useFormRoute(parent)

// Lifted off Profile.vue's `isSessionUser() && !readOnlyMode` gate on the Edit
// Profile button. A URL does not go through a button. Compared on `username`
// rather than the fetched profile's docname so it holds before that fetch lands.
//
// UX gate, not an authorization boundary — Frappe's own DocPerms on User are.
const refusal = computed(() => {
	if (readOnlyMode) return __('This site is in read-only mode.')
	if (user.data?.username !== props.username)
		return __('You can only edit your own profile.')
	return ''
})

const profileData = computed(() => props.profile?.data ?? null)

const profile = reactive({
	first_name: '',
	last_name: '',
	headline: '',
	bio: '',
	image: '',
	open_to: '',
	linkedin: '',
	github: '',
	twitter: '',
})

// Normalised to '' on both sides: `language` is nullable on User, so an unset
// language would otherwise read as a change on every save.
const hasLanguageChanged = computed(
	() => (profile.language ?? '') !== (profileData.value?.language ?? '')
)

const updateProfile = createResource({
	url: 'frappe.client.set_value',
	makeParams() {
		return {
			doctype: 'User',
			name: user.data?.name,
			fieldname: {
				user_image: profile.image || null,
				...profile,
			},
		}
	},
})

const validateMandatoryFields = () => {
	const missingFields = []
	if (!profile.first_name) missingFields.push(__('First Name'))
	if (missingFields.length) {
		toast.error(
			__('Please fill the mandatory fields: {0}').format(
				missingFields.join(', ')
			)
		)
	}
	return missingFields.length
}

const saveProfile = () => {
	if (refusal.value || !profileData.value) return
	if (validateMandatoryFields()) return

	// Read before submitting: the computed is live against the parent resource,
	// which onSuccess reloads out from under it.
	const languageChanged = hasLanguageChanged.value

	profile.bio = sanitizeOnWrite(profile.bio)
	submitResource(
		updateProfile,
		{},
		{
			onSuccess() {
				// The modal also wrote set_value's raw User doc straight into the
				// parent resource. Dropped: that resource holds get_profile_details'
				// payload, and the page behind this one is now visible, so it would
				// render a half-shaped profile for the tick before the reload lands.
				props.profile?.reload()
				toast.success(__('Profile updated successfully'))
				if (languageChanged) {
					// A language change only takes effect after the whole SPA reloads,
					// which is what the modal did. Going through location rather than
					// the router so the reload lands on the profile, not back here.
					window.location.href = router.resolve(parent).href
					return
				}
				saveAndReplace(parent)
			},
			onError(err) {
				toast.error(err.messages?.[0] || err)
			},
		}
	)
}

watch(
	profile,
	(newVal) => {
		const data = profileData.value
		if (!data) return
		const keys = Object.keys(newVal).filter((key) => key !== 'image')
		for (const key of keys) {
			if (newVal[key] !== data[key]) {
				isDirty.value = true
				return
			}
		}
		isDirty.value = profile.image !== data.user_image
	},
	{ deep: true }
)

// `immediate`, unlike the modal's copy of this watcher: a modal was created
// before its parent had fetched anything, so the change alone was enough. This
// route only mounts once that fetch has landed, so without it the form is blank.
watch(
	profileData,
	(data) => {
		if (!data) return
		profile.first_name = data.first_name
		profile.last_name = data.last_name
		profile.headline = data.headline
		profile.language = data.language
		profile.bio = data.bio
		profile.open_to = data.open_to
		profile.linkedin = data.linkedin
		profile.github = data.github
		profile.twitter = data.twitter
		profile.image = data.user_image
		isDirty.value = false
	},
	{ immediate: true }
)
</script>
