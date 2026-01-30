<template>
	<Dialog
		v-model="show"
		:options="{
			size: '3xl',
		}"
	>
		<template #body-header>
			<div class="flex items-center justify-between mb-5">
				<div class="text-2xl font-semibold leading-6 text-ink-gray-9">
					{{ __('Edit Profile') }}
				</div>
				<div class="space-x-2">
					<Badge v-if="isDirty" theme="orange">
						{{ __('Not Saved') }}
					</Badge>
					<div class="pb-5 float-right">
						<Button variant="solid" @click="saveProfile()">
							{{ __('Save') }}
						</Button>
					</div>
				</div>
			</div>
		</template>
		<template #body-content>
			<div class="text-base">
				<div class="grid grid-cols-2 gap-10">
					<div class="space-y-4">
						<div class="space-y-4">
							<Uploader
								v-model="profile.image"
								:label="__('Profile Image')"
								:required="true"
								shape="circle"
							/>

							<FormControl
								v-model="profile.first_name"
								:label="__('First Name')"
							/>
							<FormControl
								v-model="profile.last_name"
								:label="__('Last Name')"
							/>
							<FormControl v-model="profile.headline" :label="__('Headline')" />

							<FormControl
								v-model="profile.linkedin"
								:label="__('LinkedIn ID')"
							/>
							<FormControl v-model="profile.github" :label="__('GitHub ID')" />
							<FormControl
								v-model="profile.twitter"
								:label="__('Twitter ID')"
							/>
						</div>
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
							<div class="mb-1.5 text-sm text-ink-gray-5">
								{{ __('Bio') }}
							</div>
							<TextEditor
								:fixedMenu="true"
								@change="(val) => (profile.bio = val)"
								:content="profile.bio"
								:rows="15"
								editorClass="prose-sm py-2 px-2 min-h-[280px] border-outline-gray-2 hover:border-outline-gray-3 rounded-b-md bg-surface-gray-3"
							/>
						</div>
					</div>
				</div>
			</div>
		</template>
	</Dialog>
</template>
<script setup>
import {
	Badge,
	Button,
	createResource,
	Dialog,
	FormControl,
	TextEditor,
	toast,
} from 'frappe-ui'
import { ref, reactive, watch } from 'vue'
import { sanitizeHTML } from '@/utils'
import Link from '@/components/Controls/Link.vue'

const show = defineModel()
const reloadProfile = defineModel('reloadProfile')
const hasLanguageChanged = ref(false)
const isDirty = ref(false)

const props = defineProps({
	profile: {
		type: Object,
		required: true,
	},
})

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

const updateProfile = createResource({
	url: 'frappe.client.set_value',
	makeParams(values) {
		return {
			doctype: 'User',
			name: props.profile.data.name,
			fieldname: {
				user_image: profile.image || null,
				...profile,
			},
		}
	},
	onSuccess(data) {
		props.profile.data = data
	},
})

const saveProfile = () => {
	profile.bio = sanitizeHTML(profile.bio)
	updateProfile.submit(
		{},
		{
			onSuccess() {
				show.value = false
				reloadProfile.value.reload()
				if (hasLanguageChanged.value) {
					hasLanguageChanged.value = false
					window.location.reload()
				}
			},
			onError(err) {
				toast.error(err.messages?.[0] || err)
			},
		}
	)
}

watch(
	() => profile,
	(newVal) => {
		if (!props.profile.data) return
		let keys = Object.keys(newVal)
		keys.splice(keys.indexOf('image'), 1)
		for (let key of keys) {
			if (newVal[key] !== props.profile.data[key]) {
				isDirty.value = true
				return
			}
		}
		if (profile.image !== props.profile.data.user_image) {
			isDirty.value = true
			return
		}
		isDirty.value = false
	},
	{ deep: true }
)

watch(
	() => props.profile.data,
	(newVal) => {
		if (newVal) {
			profile.first_name = newVal.first_name
			profile.last_name = newVal.last_name
			profile.headline = newVal.headline
			profile.language = newVal.language
			profile.bio = newVal.bio
			profile.open_to = newVal.open_to
			profile.linkedin = newVal.linkedin
			profile.github = newVal.github
			profile.twitter = newVal.twitter
			profile.image = newVal.user_image
			isDirty.value = false
		}
	}
)

watch(
	() => profile.language,
	() => {
		if (profile.language !== props.profile.data.language) {
			hasLanguageChanged.value = true
		}
	}
)
</script>
