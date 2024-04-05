<template>
	<div class="">
		<div class="grid md:grid-cols-[70%,30%] h-full">
			<div>
				<header
					class="sticky top-0 z-10 flex flex-col md:flex-row md:items-center justify-between border-b bg-white px-3 py-2.5 sm:px-5"
				>
					<Breadcrumbs class="h-7" :items="breadcrumbs" />
					<div class="flex items-center mt-3 md:mt-0">
						<router-link
							v-if="courseResource.data"
							:to="{
								name: 'CourseDetail',
								params: { courseName: courseResource.data.name },
							}"
						>
							<Button>
								<span>
									{{ __('View Course') }}
								</span>
							</Button>
						</router-link>
						<Button variant="solid" @click="submitCourse()" class="ml-2">
							<span>
								{{ __('Save') }}
							</span>
						</Button>
					</div>
				</header>
				<div class="mt-5 mb-10">
					<div class="container mb-5">
						<div class="text-lg font-semibold mb-4">
							{{ __('Details') }}
						</div>
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
						<FileUploader
							v-if="!course.course_image"
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
											uploading ? `Uploading ${progress}%` : 'Upload an image'
										}}
									</Button>
								</div>
							</template>
						</FileUploader>
						<div v-else class="mb-4">
							<div class="text-xs text-gray-600 mb-1">
								{{ __('Course Image') }}
							</div>
							<div class="flex items-center">
								<div class="border rounded-md p-2 mr-2">
									<FileText class="h-5 w-5 stroke-1.5 text-gray-700" />
								</div>
								<div class="flex flex-col">
									<span>
										{{ course.course_image.file_name }}
									</span>
									<span class="text-sm text-gray-500 mt-1">
										{{ getFileSize(course.course_image.file_size) }}
									</span>
								</div>
								<X
									@click="removeImage()"
									class="bg-gray-200 rounded-md cursor-pointer stroke-1.5 w-5 h-5 p-1 ml-4"
								/>
							</div>
						</div>
						<FormControl
							v-model="course.video_link"
							:label="__('Preview Video')"
							class="mb-4"
						/>
						<div>
							<div class="mb-1.5 text-xs text-gray-600">
								{{ __('Tags') }}
							</div>
							<div class="flex items-center">
								<div
									v-for="tag in course.tags.split(', ')"
									class="flex items-center bg-gray-100 p-2 rounded-md mr-2"
								>
									{{ tag }}
									<X
										class="stroke-1.5 w-3 h-3 ml-2 cursor-pointer"
										@click="removeTag(tag)"
									/>
								</div>
								<FormControl v-model="newTag" @keyup.enter="updateTags()" />
							</div>
						</div>
					</div>
					<div class="container border-t">
						<div class="text-lg font-semibold mt-5 mb-4">
							{{ __('Settings') }}
						</div>
						<div class="flex items-center justify-between mb-5">
							<FormControl
								type="checkbox"
								v-model="course.published"
								:label="__('Published')"
							/>
							<FormControl
								type="checkbox"
								v-model="course.upcoming"
								:label="__('Upcoming')"
							/>
							<FormControl
								type="checkbox"
								v-model="course.disable_self_learning"
								:label="__('Disable Self Enrollment')"
							/>
						</div>
					</div>
					<div class="container border-t">
						<div class="text-lg font-semibold mt-5 mb-4">
							{{ __('Pricing') }}
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
			</div>
			<div class="border-l px-5 pt-5">
				<!-- <CreateOutline v-if="courseResource.doc" :course="courseResource.doc"/> -->
				<CourseOutline
					v-if="courseResource.data"
					:courseName="courseResource.data.name"
					:title="course.title"
					:allowEdit="true"
				/>
			</div>
		</div>
	</div>
</template>
<script setup>
import {
	Breadcrumbs,
	TextEditor,
	Button,
	createResource,
	createDocumentResource,
	FormControl,
	FileUploader,
} from 'frappe-ui'
import { inject, onMounted, computed, ref, reactive, watch } from 'vue'
import { convertToTitleCase, showToast, getFileSize } from '../utils'
import Link from '@/components/Controls/Link.vue'
import { FileText, X } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import CourseOutline from '@/components/CourseOutline.vue'

const user = inject('$user')
const newTag = ref('')
const router = useRouter()

const props = defineProps({
	courseName: {
		type: String,
	},
})

const course = reactive({
	title: '',
	short_introduction: '',
	description: '',
	video_link: '',
	course_image: null,
	tags: '',
	published: false,
	upcoming: false,
	disable_self_learning: false,
	paid_course: false,
	course_price: '',
	currency: '',
})

onMounted(() => {
	if (!user.data?.is_moderator || !user.data?.is_instructor) {
		router.push({ name: 'Courses' })
	}
	if (props.courseName !== 'new') {
		courseResource.reload()
	}
})

const courseCreationResource = createResource({
	url: 'frappe.client.insert',
	makeParams(values) {
		return {
			doc: {
				doctype: 'LMS Course',
				image: course.course_image.file_url,
				...values,
			},
		}
	},
})

const courseEditResource = createResource({
	url: 'frappe.client.set_value',
	auto: false,
	makeParams(values) {
		return {
			doctype: 'LMS Course',
			name: values.course,
			fieldname: {
				image: course.course_image.file_url,
				...course,
			},
		}
	},
})

const courseResource = createResource({
	url: 'frappe.client.get',
	makeParams(values) {
		return {
			doctype: 'LMS Course',
			name: props.courseName,
		}
	},
	auto: false,
	onSuccess(data) {
		Object.keys(data).forEach((key) => {
			if (Object.hasOwn(course, key)) course[key] = data[key]
		})
		let checkboxes = [
			'published',
			'upcoming',
			'disable_self_learning',
			'paid_course',
		]
		for (let idx in checkboxes) {
			let key = checkboxes[idx]
			course[key] = course[key] ? true : false
		}

		if (data.image) imageResource.reload({ image: data.image })
	},
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
		course.course_image = data
	},
})

const getTags = computed(() => {
	return courseResource.doc?.tags
		? courseResource.doc.tags.split(', ')
		: tags.value?.split(', ')
})

const submitCourse = () => {
	if (courseResource.data) {
		courseEditResource.submit(
			{
				course: courseResource.data.name,
			},
			{
				onSuccess() {
					showToast('Success', 'Course updated successfully', 'check')
				},
				onError(err) {
					showToast('Error', err.messages?.[0] || err, 'x')
				},
			}
		)
	} else {
		courseCreationResource.submit(course, {
			onSuccess(data) {
				showToast('Success', 'Course created successfully', 'check')
				router.push({
					name: 'CreateCourse',
					params: { courseName: data.name },
				})
			},
			onError(err) {
				showToast(err)
			},
		})
	}
}

const validateMandatoryFields = () => {
	const mandatory_fields = [
		'title',
		'short_introduction',
		'description',
		'video_link',
		'course_image',
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
}

watch(
	() => props.courseName !== 'new',
	(newVal) => {
		if (newVal) {
			courseResource.reload()
		}
	}
)

const validateFile = (file) => {
	let extension = file.name.split('.').pop().toLowerCase()
	if (!['jpg', 'jpeg', 'png'].includes(extension)) {
		return 'Only image file is allowed.'
	}
}

const updateTags = () => {
	if (newTag.value) {
		course.tags = course.tags ? `${course.tags}, ${newTag.value}` : newTag.value
		newTag.value = ''
	}
}

const removeTag = (tag) => {
	course.tags = course.tags
		?.split(', ')
		.filter((t) => t !== tag)
		.join(', ')
	newTag.value = ''
}

const saveImage = (file) => {
	course.course_image = file
}

const removeImage = () => {
	course.course_image = null
}

const breadcrumbs = computed(() => {
	let crumbs = [
		{
			label: 'Courses',
			route: { name: 'Courses' },
		},
	]
	if (courseResource.data) {
		crumbs.push({
			label: course.title,
			route: { name: 'CourseDetail', params: { courseName: props.courseName } },
		})
	}
	crumbs.push({
		label: props.courseName == 'new' ? 'New Course' : 'Edit Course',
		route: { name: 'CreateCourse', params: { courseName: props.courseName } },
	})
	return crumbs
})
</script>
