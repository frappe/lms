<template>
	<Dialog
		:options="{
			title: 'Edit profile',
			size: '3xl',
		}"
	>
		<template #body-content>
			<div class="mb-8 flex justify-center">
				<div class="mb-4">
					<FileUploader
						:fileTypes="['image/*']"
						:validateFile="validateFile"
						@success="(file) => saveImage(file)"
					>
						<template v-slot="{ file, progress, uploading, openFileSelector }">
							<div class="relative h-fit w-fit">
								<Avatar
									class="avatar border border-outline-gray-2 cursor-auto rounded-full object-cover shadow-sm h-[100px] w-[100px]"
									:label="profile.first_name"
									:image="profile.image?.file_url"
									size="lg"
								/>

								<div
									v-if="uploading"
									class="absolute top-0 left-0 right-0 bottom-0 rounded-full bg-white/50 text-gray-900 flex items-center justify-center font-semibold"
								>
									{{ `${progress}%` }}
								</div>

								<div
									@click="openFileSelector"
									class="absolute top-1/2 right-0 bg-white rounded-md cursor-pointer stroke-1.5 w-5 h-5 p-1 ml-4"
								>
									<GalleryEditIcon />
								</div>
							</div>
						</template>
					</FileUploader>
				</div>
			</div>
			<div class="grid grid-cols-2 gap-5">
				<div class="space-y-4">
					<!-- <Uploader
						v-model="profile.image.file_url"
						label="Profile Image"
						description="Your profile image to help others recognize you."
					/> -->

					<FormWrapper class="space-y-4">
						<FormControl
							v-model="profile.first_name"
							:label="__('First Name')"
						/>
						<FormControl v-model="profile.last_name" :label="__('Last Name')" />
						<FormControl v-model="profile.headline" :label="__('Headline')" />
					</FormWrapper>
					<FormWrapper class="mt-4" type="combobox">
						<Link
							:label="__('Language')"
							v-model="profile.language"
							doctype="Language"
						/>
					</FormWrapper>
				</div>
				<div>
					<div class="mb-4">
						<div class="mb-1.5 text-sm text-ink-gray-5">
							{{ __('Bio') }}
						</div>
						<FormWrapper type="editorBottomMenu">
							<TextEditor
								:fixed-menu="true"
								@change="(val) => (profile.bio = val)"
								:content="profile.bio"
								editorClass="prose-sm py-2 px-2 min-h-[200px] rounded-md border-outline-gray-2 hover:border-outline-gray-3 bg-surface-gray-3 max-h-[400px] overflow-y-auto"
							/>
						</FormWrapper>
					</div>
				</div>
			</div>
		</template>
		<template #actions="{ close }">
			<Button class="w-full" variant="solid" @click="saveProfile(close)">
				Save
			</Button>
		</template>
	</Dialog>
</template>
<script setup>
import {
	Dialog,
	FormControl,
	FileUploader,
	createResource,
	TextEditor,
	toast,
	Avatar,
} from 'frappe-ui'
import { ref, reactive, watch } from 'vue'
import { X } from 'lucide-vue-next'
import { getFileSize, decodeEntities } from '@/utils'
import Link from '@/components/Controls/Link.vue'
import DOMPurify from 'dompurify'
import FormWrapper from '@/components/ui/FormWrapper.vue'
import Button from '@/components/ui/Button.vue'
import GalleryEditIcon from '../Icons/GalleryEditIcon.vue'

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
	profile.bio = DOMPurify.sanitize(decodeEntities(profile.bio), {
		ALLOWED_TAGS: [
			'b',
			'i',
			'em',
			'strong',
			'a',
			'p',
			'br',
			'ul',
			'ol',
			'li',
			'img',
		],
		ALLOWED_ATTR: ['href', 'target', 'src'],
	})
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
		},
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
			if (newVal.user_image) imageResource.submit({ image: newVal.user_image })
		}
	},
)

watch(
	() => profile.language,
	() => {
		if (profile.language !== props.profile.data.language) {
			hasLanguageChanged.value = true
		}
	},
)
</script>
