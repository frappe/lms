<template>
	<div class="h-screen text-base">
		<div class="grid grid-cols-[75%,25%] h-full">
			<div>
				<header
					class="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-3 py-2.5 sm:px-5"
				>
					<Breadcrumbs :items="breadcrumbs" />
					<Button variant="solid" @click="saveLesson()">
						{{ __('Save') }}
					</Button>
				</header>
				<div class="w-5/6 mx-auto py-5">
					<div class="flex items-center justify-between mb-5">
						<div class="text-lg font-semibold">
							{{ __('Lesson Details') }}
						</div>
					</div>
					<FormControl v-model="lesson.title" label="Title" class="mb-4" />
					<FormControl
						v-model="lesson.include_in_preview"
						type="checkbox"
						label="Include in Preview"
					/>
					<div class="mt-4">
						<label class="block text-xs text-gray-600 mb-1">
							{{ __('Instructor Notes') }}
						</label>
						<div
							id="instructor-notes"
							class="border rounded-md px-10 py-3"
						></div>
					</div>
					<div class="mt-4">
						<label class="block text-xs text-gray-600 mb-1">
							{{ __('Content') }}
						</label>
						<div id="content" class="border rounded-md py-3"></div>
					</div>
				</div>
			</div>
			<div class="border-l px-5 pt-5">
				<div class="text-lg font-semibold">
					{{ __('Components') }}
				</div>
				<div class="mt-5">
					<div class="flex">
						<Link
							v-model="quiz"
							class="flex-1"
							doctype="LMS Quiz"
							:label="__('Select a Quiz')"
						/>
						<Button @click="addQuiz()" class="self-end ml-2">
							<template #icon>
								<Plus class="h-4 w-4 stroke-1.5" />
							</template>
						</Button>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>
<script setup>
import {
	Breadcrumbs,
	FormControl,
	createResource,
	Button,
	createDocumentResource,
} from 'frappe-ui'
import { computed, reactive, onMounted, inject, ref } from 'vue'
import EditorJS from '@editorjs/editorjs'
import { createToast } from '../utils'
import Link from '@/components/Controls/Link.vue'
import { Plus } from 'lucide-vue-next'
import { getEditorTools } from '../utils'

let editor
const user = inject('$user')
const quiz = ref(null)

const props = defineProps({
	courseName: {
		type: String,
		required: true,
	},
	chapterNumber: {
		type: String,
		required: true,
	},
	lessonNumber: {
		type: String,
		required: true,
	},
})

onMounted(() => {
	if (!user.data?.is_moderator || !user.data?.is_instructor) {
		window.location.href = '/login'
	}
	editor = renderEditor('content')
})

const renderEditor = (holder) => {
	return new EditorJS({
		holder: holder,
		tools: getEditorTools(),
	})
}

const lesson = reactive({
	title: '',
	include_in_preview: false,
	body: 'Test',
	instructor_notes: '',
	content: '',
})

const lessonDetails = createResource({
	url: 'lms.lms.utils.get_lesson_creation_details',
	params: {
		course: props.courseName,
		chapter: props.chapterNumber,
		lesson: props.lessonNumber,
	},
	auto: true,
	onSuccess(data) {
		if (data.lesson) {
			Object.keys(data.lesson).forEach((key) => {
				lesson[key] = data.lesson[key]
			})
			lesson.include_in_preview = data.include_in_preview ? true : false
			editor.isReady.then(() => {
				editor.render(JSON.parse(data.lesson.content))
			})
		}
	},
})

const newLessonResource = createResource({
	url: 'frappe.client.insert',
	makeParams(values) {
		return {
			doc: {
				doctype: 'Course Lesson',
				course: props.courseName,
				chapter: lessonDetails.data?.chapter.name,
				...lesson,
			},
		}
	},
})

const editLesson = createResource({
	url: 'frappe.client.set_value',
	makeParams(values) {
		return {
			doctype: 'Course Lesson',
			name: values.lesson,
			fieldname: lesson,
		}
	},
})

const lessonReference = createResource({
	url: 'frappe.client.insert',
	makeParams(values) {
		return {
			doc: {
				doctype: 'Lesson Reference',
				parent: lessonDetails.data?.chapter.name,
				parenttype: 'Course Chapter',
				parentfield: 'lessons',
				lesson: values.lesson,
				idx: props.lessonNumber,
			},
		}
	},
})

const saveLesson = () => {
	editor.save().then((outputData) => {
		lesson.content = JSON.stringify(outputData)
		if (lessonDetails.data?.lesson) {
			editLesson.submit(
				{
					lesson: lessonDetails.data.lesson.name,
				},
				{
					validate() {
						return validateLesson()
					},
					onSuccess() {
						showToast('Success', 'Lesson updated successfully', 'check')
					},
					onError(err) {
						showToast('Error', err.message, 'x')
					},
				}
			)
		} else {
			createNewLesson()
		}
	})
}

const createNewLesson = () => {
	newLessonResource.submit(
		{},
		{
			validate() {
				return validateLesson()
			},
			onSuccess(data) {
				lessonReference.submit(
					{ lesson: data.name },
					{
						onSuccess() {
							showToast('Success', 'Lesson created successfully', 'check')
						},
					}
				)
			},
			onError(err) {
				showToast('Error', err.message, 'x')
			},
		}
	)
}

const validateLesson = () => {
	if (!lesson.title) {
		return 'Title is required'
	}
	if (!lesson.content) {
		return 'Content is required'
	}
}

const addQuiz = () => {
	if (quiz.value) {
		editor.blocks.insert(
			'quiz',
			{
				quiz: quiz.value,
			},
			{},
			editor.blocks.getBlocksCount()
		)
		quiz.value = null
	}
}

const showToast = (title, text, icon) => {
	createToast({
		title: title,
		text: text,
		icon: icon,
		iconClasses:
			icon == 'check'
				? 'bg-green-600 text-white rounded-md p-px'
				: 'bg-red-600 text-white rounded-md p-px',
		position: icon == 'check' ? 'bottom-right' : 'top-center',
		timeout: icon == 'check' ? 5 : 10,
	})
}

const breadcrumbs = computed(() => {
	let crumbs = [
		{
			label: 'Courses',
			route: { name: 'Courses' },
		},
		{
			label: lessonDetails.data?.course_title,
			route: { name: 'CourseDetail', params: { courseName: props.courseName } },
		},
	]

	if (lessonDetails?.data?.lesson) {
		crumbs.push({
			label: lessonDetails.data.lesson.title,
			route: {
				name: 'Lesson',
				params: {
					courseName: props.courseName,
					chapterNumber: props.chapterNumber,
					lessonNumber: props.lessonNumber,
				},
			},
		})
	}
	crumbs.push({
		label: lessonDetails?.data?.lesson ? 'Edit Lesson' : 'Create Lesson',
		route: {
			name: 'CreateLesson',
			params: {
				courseName: props.courseName,
				chapterNumber: props.chapterNumber,
				lessonNumber: props.lessonNumber,
			},
		},
	})
	return crumbs
})
</script>
