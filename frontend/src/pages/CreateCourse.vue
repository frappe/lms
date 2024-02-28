<template>
	<div class="h-screen text-base">
		<div class="grid grid-cols-[70%,30%] h-full">
			<div>
				<header
					class="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-3 py-2.5 sm:px-5"
				>
					<Breadcrumbs
						class="h-7"
						:items="[
							{
								label: __('Courses'),
								route: { name: 'Courses' },
							},
							{
								label: __('New Course'),
								route: { name: 'CreateCourse', params: { courseName: 'new' } },
							},
						]"
					/>
					<Button variant="solid" @click="submitCourse()">
						<span>
							{{ __('Save') }}
						</span>
					</Button>
				</header>
				<div class="container mt-5">
					<FormControl
						v-model="course.title"
						:label="__('Title')"
						class="mb-4"
					/>
					<FormControl
						v-model="course.short_introduction"
						:label="__('Short Introduction')"
						class="mb-4"
					/>
					<div class="mb-4">
						<div class="mb-1.5 text-sm text-gray-700">
							{{ __('Course Description') }}
						</div>
						<TextEditor
							:content="course.description"
							@change="(val) => (course.description = val)"
							:editable="true"
							:fixedMenu="true"
							editorClass="prose-sm max-w-none border-b border-x bg-gray-100 rounded-b-md py-1 px-2 min-h-[7rem]"
						/>
					</div>
					<FormControl
						v-model="course.video_link"
						:label="__('Preview Video')"
						class="mb-4"
					/>
					<FileUploader
						v-if="!course.image"
						:fileTypes="['image/*']"
						:validateFile="validateFile"
						@success="
							(file) => {
								console.log(file)
								course.image = file
								console.log(course.image)
							}
						"
					>
						<template v-slot="{ file, progress, uploading, openFileSelector }">
							<div class="mb-4">
								<Button @click="openFileSelector" :loading="uploading">
									{{ uploading ? `Uploading ${progress}%` : 'Upload an image' }}
								</Button>
							</div>
						</template>
					</FileUploader>
					<div v-else class="flex items-center">
						<div class="border rounded-md p-2 mr-2">
							<FileText class="h-5 w-5 stroke-1.5 text-gray-700" />
						</div>
						<div class="flex flex-col">
							<span>
								{{ course.image }}
							</span>
							<span class="text-sm text-gray-500 mt-1">
								{{ getFileSize(course.image) }}
							</span>
						</div>
					</div>
					<FormControl v-model="course.tags" :label="__('Tags')" class="mb-4" />
					<div class="flex items-center mb-4">
						<FormControl
							type="checkbox"
							v-model="course.published"
							:label="__('Published')"
						/>
						<FormControl
							type="checkbox"
							v-model="course.upcoming"
							:label="__('Upcoming')"
							class="ml-20"
						/>
					</div>
					<div class="mb-4">
						<FormControl
							type="checkbox"
							v-model="course.paid_course"
							:label="__('Paid Course')"
						/>
					</div>
					<FormControl
						v-model="course.course_price"
						:label="__('Course Price')"
						class="mb-4"
					/>
					<Link
						doctype="Currency"
						v-model="course.currency"
						:filters="{ enabled: 1 }"
						:label="__('Currency')"
					/>
				</div>
			</div>
			<div class="bg-gray-50"></div>
		</div>
	</div>
</template>
<script setup>
import {
	Breadcrumbs,
	TextEditor,
	Button,
	createResource,
	FormControl,
	FileUploader,
} from 'frappe-ui'
import { reactive, inject, onMounted } from 'vue'
import { convertToTitleCase, createToast, getFileSize } from '../utils'
import Link from '@/components/Controls/Link.vue'
import { FileText } from 'lucide-vue-next'

const user = inject('$user')

onMounted(() => {
	if (!user.data?.is_moderator || !user.data?.is_instructor) {
		window.location.href = '/login'
	}
})

const course = reactive({
	title: '',
	short_introduction: '',
	description: '',
	video_link: '',
	tags: '',
	published: false,
	upcoming: false,
	image: null,
	paid_course: false,
	course_price: null,
	currency: '',
})

const courseResource = createResource({
	url: 'frappe.client.insert',
	makeParams() {
		return {
			doc: {
				doctype: 'LMS Course',
				...course,
			},
		}
	},
})

const submitCourse = () => {
	courseResource.submit(
		{},
		{
			validate() {
				const mandatory_fields = [
					'title',
					'short_introduction',
					'description',
					'video_link',
					'image',
				]
				for (const field of mandatory_fields) {
					if (!course[field]) {
						let fieldLabel = convertToTitleCase(field.split('_').join(' '))
						return `${fieldLabel} is mandatory`
					}
				}
				if (course.paid_course && (!course.course_price || !course.currency)) {
					return 'Course price and currency are mandatory for paid courses'
				}
			},
			onError(err) {
				createToast({
					title: 'Error',
					text: err.messages?.[0] || err,
					icon: 'x',
					iconClasses: 'bg-red-600 text-white rounded-md p-px',
					position: 'top-center',
					timeout: 10,
				})
			},
		}
	)
}

const validateFile = (file) => {
	console.log(file)
	let extension = file.name.split('.').pop().toLowerCase()
	if (!['jpg', 'jpeg', 'png'].includes(extension)) {
		return 'Only image file is allowed.'
	}
}
</script>
