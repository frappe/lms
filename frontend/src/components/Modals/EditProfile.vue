<template>
	<Dialog
		:options="{
			title: 'Edit your profile',
			size: 'xl',
			actions: [
				{
					label: 'Save',
					variant: 'solid',
					onClick: (close) => saveProfile(close),
				},
			],
		}"
	>
		<template #body-content>
			<div>
				<FileUploader
					v-if="!profile.image"
					:fileTypes="['image/*']"
					:validateFile="validateFile"
					@success="(file) => saveImage(file)"
				>
					<template v-slot="{ file, progress, uploading, openFileSelector }">
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
					<div class="text-xs text-ink-gray-5 mb-1">
						{{ __('Profile Image') }}
					</div>
					<div class="flex items-center">
						<div class="border rounded-md p-2 mr-2">
							<FileText class="h-5 w-5 stroke-1.5 text-ink-gray-7" />
						</div>
						<div class="text-base flex flex-col">
							<span>
								{{ profile.image.file_name }}
							</span>
							<span class="text-sm text-ink-gray-4 mt-1">
								{{ getFileSize(profile.image.file_size) }}
							</span>
						</div>
						<X
							@click="removeImage()"
							class="bg-surface-gray-3 rounded-md cursor-pointer stroke-1.5 w-5 h-5 p-1 ml-4"
						/>
					</div>
				</div>
				<FormControl
					v-model="profile.first_name"
					:label="__('First Name')"
					class="mb-4"
				/>
				<FormControl
					v-model="profile.last_name"
					:label="__('Last Name')"
					class="mb-4"
				/>
				<FormControl
					v-model="profile.headline"
					:label="__('Headline')"
					class="mb-4"
				/>

				<div class="mb-4">
					<div class="mb-1.5 text-sm text-ink-gray-5">
						{{ __('Bio') }}
					</div>
					<TextEditor
						:fixedMenu="true"
						@change="(val) => (profile.bio = val)"
						:content="profile.bio"
						editorClass="prose-sm py-2 px-2 min-h-[200px] border-outline-gray-2 hover:border-outline-gray-3 rounded-md bg-surface-gray-3"
					/>
				</div>
			</div>
		</template>
	</Dialog>
</template>
<script setup>
import {
	Dialog,
	FormControl,
	FileUploader,
	Button,
	createResource,
	TextEditor,
	toast,
} from 'frappe-ui'
import { reactive, watch } from 'vue'
import { FileText, X } from 'lucide-vue-next'
import { getFileSize, escapeHTML } from '@/utils'

const reloadProfile = defineModel('reloadProfile')

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
		profile.bio = escapeHTML(profile.bio)
		return {
			doctype: 'User',
			name: props.profile.data.name,
			fieldname: {
				user_image: profile.image.file_url,
				...profile,
			},
		}
	},
	onSuccess(data) {
		props.profile.data = data
	},
})

const saveProfile = (close) => {
	updateProfile.submit(
		{},
		{
			onSuccess() {
				close()
				reloadProfile.value.reload()
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
			profile.bio = newVal.bio
			if (newVal.user_image) imageResource.submit({ image: newVal.user_image })
		}
	}
)
</script>
