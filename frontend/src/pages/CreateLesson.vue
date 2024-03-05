<template>
	<div class="h-screen text-base">
		<header
			class="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-3 py-2.5 sm:px-5"
		>
			<Breadcrumbs :items="breadcrumbs" />
		</header>
		<div class="w-7/12 mx-auto py-5">
			<div class="flex items-center justify-between mb-5">
				<div class="text-lg font-semibold">
					{{ __('Lesson Details') }}
				</div>
				<Button variant="solid" @click="saveLesson()">
					{{ __('Save') }}
				</Button>
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
				<div id="instructor-notes" class="border rounded-md px-10 py-3"></div>
			</div>
			<div class="mt-4">
				<label class="block text-xs text-gray-600 mb-1">
					{{ __('Content') }}
				</label>
				<div id="content" class="border rounded-md py-3"></div>
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
import { computed, reactive, onMounted, onBeforeMount } from 'vue'
import EditorJS from '@editorjs/editorjs'
import Header from '@editorjs/header'
import Paragraph from '@editorjs/paragraph'
import List from '@editorjs/list'
import Embed from '@editorjs/embed'
import YouTubeVideo from '../utils/youtube.js'
import { createToast } from '../utils'

let editor
let editLessonResource

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
	editor = renderEditor('content')
	/* renderEditor('instructor-notes') */
})

const renderEditor = (holder) => {
	return new EditorJS({
		holder: holder,
		tools: getEditorTools(),
	})
}

const getEditorTools = () => {
	return {
		header: Header,
		youtube: YouTubeVideo,
		paragraph: {
			class: Paragraph,
			inlineToolbar: true,
			config: {
				preserveBlank: true,
			},
		},
		list: List,
		embed: {
			class: Embed,
			config: {
				services: {
					youtube: true,
					vimeo: true,
					codepen: true,
					slides: {
						regex:
							/https:\/\/docs\.google\.com\/presentation\/d\/e\/([A-Za-z0-9_-]+)\/pub/,
						embedUrl:
							'https://docs.google.com/presentation/d/e/<%= remote_id %>/embed',
						html: "<iframe width='100%' height='300' frameborder='0' allowfullscreen='true'></iframe>",
					},
				},
			},
		},
	}
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
			createEditResource(data)
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

const createEditResource = (data) => {
	editLessonResource = createDocumentResource({
		doctype: 'Course Lesson',
		name: data.lesson,
		auto: true,
		onSuccess(data) {
			Object.keys(data).forEach((key) => {
				lesson[key] = data[key]
			})
			lesson.include_in_preview = data.include_in_preview ? true : false
			console.log(editor)
			console.log(editor.isReady)
			editor.isReady.then(() => {
				editor.render(JSON.parse(data.content))
			})
		},
	})
}

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
		console.log(editLessonResource?.doc?.modified)
		if (editLessonResource?.doc) {
			editLessonResource.setValue.submit(
				{
					...lesson,
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

	if (editLessonResource?.doc) {
		crumbs.push({
			label: editLessonResource.doc.title,
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
		label: editLessonResource?.doc ? 'Edit Lesson' : 'Create Lesson',
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
