<template>
	<Dialog
		:options="{
			title: 'Edit your profile',
			size: '3xl',
		}"
	>
		<template #body-content>
			<div>
				<div class="grid grid-cols-2 gap-10">
					<div>
						<div class="text-xs text-ink-gray-5 mb-1">
							{{ __('Profile Image') }}
						</div>
						<FileUploader
							v-if="!profile.image"
							:fileTypes="['image/*']"
							:validateFile="validateFile"
							@success="(file) => saveImage(file)"
						>
							<template
								v-slot="{ file, progress, uploading, openFileSelector }"
							>
								<div class="mb-4">
									<Button @click="openFileSelector" :loading="uploading">
										{{
											uploading
												? `Uploading ${progress}%`
												: 'Upload a profile image'
										}}
									</Button>
								</div>
							</template>
						</FileUploader>
						<div v-else class="mb-4">
							<div class="flex items-center">
								<img
									:src="profile.image?.file_url"
									class="object-cover h-[50px] w-[50px] rounded-full border-4 border-white object-cover"
								/>

								<div class="text-base flex flex-col ml-2">
									<span>
										{{ profile.image?.file_name }}
									</span>
									<span class="text-sm text-ink-gray-4 mt-1">
										{{ getFileSize(profile.image?.file_size) }}
									</span>
								</div>
								<X
									@click="removeImage()"
									class="bg-surface-gray-3 rounded-md cursor-pointer stroke-1.5 w-5 h-5 p-1 ml-4"
								/>
							</div>
						</div>
					</div>
					<Switch
						v-model="profile.looking_for_job"
						:label="__('Open to Opportunities')"
						:description="
							__('Show recruiters and others that you are open to work.')
						"
						class="!px-0"
					/>
				</div>

				<div class="grid grid-cols-2 gap-10">
					<div class="space-y-4">
						<div class="space-y-4">
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
								editorClass="prose-sm py-2 px-2 min-h-[200px] border-outline-gray-2 hover:border-outline-gray-3 rounded-b-md bg-surface-gray-3"
							/>
						</div>
					</div>
				</div>
			</div>
		</template>
		<template #actions="{ close }">
			<div class="pb-5 float-right">
				<Button variant="solid" @click="saveProfile(close)">
					{{ __('Save') }}
				</Button>
			</div>
		</template>
	</Dialog>
</template>
<script setup>
import {
	Button,
	createResource,
	Dialog,
	FormControl,
	FileUploader,
	Switch,
	TextEditor,
	toast,
} from 'frappe-ui'
import { ref, reactive, watch } from 'vue'
import { X } from 'lucide-vue-next'
import { getFileSize, sanitizeHTML } from '@/utils'
import Link from '@/components/Controls/Link.vue'

const reloadProfile = defineModel('reloadProfile')
const hasLanguageChanged = ref(false)

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
	looking_for_job: false,
	linkedin: '',
	github: '',
	twitter: '',
})

const imageResource = createResource({
	url: 'lms.lms.api.get_file_info',
	makeParams(values) {
		return {
			file_url: values.image,
		}
	},
	auto: false,
	onSuccess(data) {
		profile.image = data
	},
})

const updateProfile = createResource({
	url: 'frappe.client.set_value',
	makeParams(values) {
		return {
			doctype: 'User',
			name: props.profile.data.name,
			fieldname: {
				user_image: profile.image?.file_url || null,
				...profile,
			},
		}
	},
	onSuccess(data) {
		props.profile.data = data
	},
})

const saveProfile = (close) => {
	profile.bio = sanitizeHTML(profile.bio)
	updateProfile.submit(
		{},
		{
			onSuccess() {
				close()
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

const validateFile = (file) => {
	let extension = file.name.split('.').pop().toLowerCase()
	if (!['jpg', 'jpeg', 'png'].includes(extension)) {
		return 'Only image file is allowed.'
	}
}

const saveImage = (file) => {
	profile.image = file
}

const removeImage = () => {
	profile.image = null
}

watch(
	() => props.profile.data,
	(newVal) => {
		if (newVal) {
			profile.first_name = newVal.first_name
			profile.last_name = newVal.last_name
			profile.headline = newVal.headline
			profile.language = newVal.language
			profile.bio = newVal.bio
			profile.looking_for_job = newVal.looking_for_job
			profile.linkedin = newVal.linkedin
			profile.github = newVal.github
			profile.twitter = newVal.twitter
			if (newVal.user_image) imageResource.submit({ image: newVal.user_image })
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
