<template>
	<div class="h-screen text-base">
		<header
			class="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-3 py-2.5 sm:px-5"
		>
			<Breadcrumbs :items="breadcrumbs" />
		</header>
		<div class="w-7/12 mx-auto pt-5">
			<div class="text-lg font-semibold mb-5">
				{{ __('Lesson Details') }}
			</div>
			<FormControl v-model="lesson.title" label="Title" class="mb-4" />
			<FormControl
				v-model="lesson.include_in_preview"
				type="checkbox"
				label="Include in Preview"
			/>
			<div class="mt-4">
				<label class="block text-xs text-gray-600 mb-1">
					{{ __('Content') }}
				</label>
				<div id="content" class="border rounded-md px-10 py-3"></div>
			</div>
		</div>
	</div>
</template>
<script setup>
import { Breadcrumbs, FormControl, createResource } from 'frappe-ui'
import { computed, reactive, onMounted } from 'vue'
import EditorJS from '@editorjs/editorjs'
import Header from '@editorjs/header'
import Paragraph from '@editorjs/paragraph'
import List from '@editorjs/list'
import Embed from '@editorjs/embed'
import YouTubeVideo from '../utils/youtube.js'

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

onMounted(
	() =>
		new EditorJS({
			holder: 'content',
			tools: {
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
			},
		})
)

const lesson = reactive({
	title: '',
	include_in_preview: false,
	body: '',
	instructor_notes: '',
})

const lessonDetails = createResource({
	url: 'lms.lms.utils.get_lesson_creation_details',
	params: {
		course: props.courseName,
		chapter: props.chapterNumber,
		lesson: props.lessonNumber,
	},
	auto: true,
})

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

	crumbs.push({
		label: 'Create Lesson',
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
