<template>
	<div class="">
		<div class="grid md:grid-cols-[75%,25%] h-screen">
			<div class="border-r">
				<header
					class="sticky top-0 z-10 flex flex-col md:flex-row md:items-center justify-between border-b overflow-hidden bg-white px-3 py-2.5 sm:px-5"
				>
					<Breadcrumbs class="text-ellipsis" :items="breadcrumbs" />
					<Button variant="solid" @click="saveLesson()" class="mt-3 md:mt-0">
						{{ __('Save') }}
					</Button>
				</header>
				<div class="py-5">
					<div class="w-5/6 mx-auto">
						<FormControl v-model="lesson.title" label="Title" class="mb-4" />
						<FormControl
							v-model="lesson.include_in_preview"
							type="checkbox"
							label="Include in Preview"
						/>
					</div>
					<div class="border-t mt-4">
						<div class="w-5/6 mx-auto pt-4">
							<div
								class="flex justify-between cursor-pointer"
								@click="
									() => {
										openInstructorEditor = !openInstructorEditor
									}
								"
							>
								<label class="block font-medium text-gray-600 mb-1">
									{{ __('Instructor Notes') }}
								</label>
								<ChevronRight
									class="stroke-2 h-5 w-5 text-gray-600"
									:class="{
										'rotate-90 transform duration-200': openInstructorEditor,
										'duration-200': !openInstructorEditor,
									}"
								/>
							</div>
							<div
								v-show="openInstructorEditor"
								id="instructor-notes"
								class="ProseMirror prose prose-table:table-fixed prose-td:p-2 prose-th:p-2 prose-td:border prose-th:border prose-td:border-gray-300 prose-th:border-gray-300 prose-td:relative prose-th:relative prose-th:bg-gray-100 prose-sm max-w-none !whitespace-normal py-3"
							></div>
						</div>
					</div>
					<div class="border-t mt-4">
						<div class="w-5/6 mx-auto pt-4">
							<label class="block font-medium text-gray-600 mb-1">
								{{ __('Content') }}
							</label>
							<div
								id="content"
								class="ProseMirror prose prose-table:table-fixed prose-td:p-2 prose-th:p-2 prose-td:border prose-th:border prose-td:border-gray-300 prose-th:border-gray-300 prose-td:relative prose-th:relative prose-th:bg-gray-100 prose-sm max-w-none !whitespace-normal py-3"
							></div>
						</div>
					</div>
				</div>
			</div>
			<div class="">
				<div class="sticky top-0 p-5">
					<LessonPlugins :editor="editor" :notesEditor="instructorEditor" />
				</div>
			</div>
		</div>
	</div>
</template>
<script setup>
import { Breadcrumbs, FormControl, createResource, Button } from 'frappe-ui'
import { computed, reactive, onMounted, inject, ref, watch } from 'vue'
import EditorJS from '@editorjs/editorjs'
import LessonPlugins from '@/components/LessonPlugins.vue'
import { ChevronRight } from 'lucide-vue-next'
import { updateDocumentTitle, createToast, getEditorTools } from '@/utils'

const editor = ref(null)
const instructorEditor = ref(null)
const user = inject('$user')
const openInstructorEditor = ref(false)
let autoSaveInterval

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
	if (!user.data?.is_moderator && !user.data?.is_instructor) {
		window.location.href = '/login'
	}
	editor.value = renderEditor('content')
	instructorEditor.value = renderEditor('instructor-notes')
})

const renderEditor = (holder) => {
	return new EditorJS({
		holder: holder,
		tools: getEditorTools(),
		autofocus: true,
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
			addLessonContent(data)
			addInstructorNotes(data)
			enableAutoSave()
		}
	},
})

const addLessonContent = (data) => {
	editor.value.isReady.then(() => {
		if (data.lesson.content) {
			editor.value.render(JSON.parse(data.lesson.content))
		} else if (data.lesson.body) {
			let blocks = convertToJSON(data.lesson)
			editor.value.render({
				blocks: blocks,
			})
		}
	})
}

const addInstructorNotes = (data) => {
	instructorEditor.value.isReady.then(() => {
		if (data.lesson.instructor_content) {
			instructorEditor.value.render(JSON.parse(data.lesson.instructor_content))
		} else if (data.lesson.instructor_notes) {
			let blocks = convertToJSON(data.lesson)
			instructorEditor.value.render({
				blocks: blocks,
			})
		}
	})
}

const enableAutoSave = () => {
	autoSaveInterval = setInterval(() => {
		saveLesson()
	}, 10000)
}

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

const convertToJSON = (lessonData) => {
	let blocks = []
	if (lessonData.youtube) {
		let youtubeID = lessonData.youtube.split('/').pop()
		blocks.push({
			type: 'embed',
			data: {
				service: 'youtube',
				embed: `https://www.youtube.com/embed/${youtubeID}`,
			},
		})
	}
	lessonData.body.split('\n').forEach((block) => {
		if (block.includes('{{ YouTubeVideo')) {
			let youtubeID = block.match(/\(["']([^"']+?)["']\)/)[1]
			if (!youtubeID.includes('https://'))
				youtubeID = `https://www.youtube.com/embed/${youtubeID}`
			blocks.push({
				type: 'embed',
				data: {
					service: 'youtube',
					embed: youtubeID,
				},
			})
		} else if (block.includes('{{ Quiz')) {
			let quiz = block.match(/\(["']([^"']+?)["']\)/)[1]
			blocks.push({
				type: 'quiz',
				data: {
					quiz: quiz,
				},
			})
		} else if (block.includes('{{ Video')) {
			let video = block.match(/\(["']([^"']+?)["']\)/)[1]
			blocks.push({
				type: 'upload',
				data: {
					file_url: video,
					file_type: 'video',
				},
			})
		} else if (block.includes('{{ Audio')) {
			let audio = block.match(/\(["']([^"']+?)["']\)/)[1]
			blocks.push({
				type: 'upload',
				data: {
					file_url: audio,
					file_type: 'audio',
				},
			})
		} else if (block.includes('{{ PDF')) {
			let pdf = block.match(/\(["']([^"']+?)["']\)/)[1]
			blocks.push({
				type: 'upload',
				data: {
					file_url: pdf,
					file_type: 'pdf',
				},
			})
		} else if (block.includes('{{ Embed')) {
			let embed = block.match(/\(["']([^"']+?)["']\)/)[1]
			blocks.push({
				type: 'embed',
				data: {
					service: embed.split('|||')[0],
					embed: embed.split('|||')[1],
				},
			})
		} else if (block.includes('![]')) {
			let image = block.match(/\((.*?)\)/)[1]
			blocks.push({
				type: 'upload',
				data: {
					file_url: image,
					file_type: 'image',
				},
			})
		} else if (block.includes('#')) {
			let level = (block.match(/#/g) || []).length
			blocks.push({
				type: 'header',
				data: {
					text: block.replace(/#/g, '').trim(),
					level: level,
				},
			})
		} else {
			blocks.push({
				type: 'paragraph',
				data: {
					text: block,
				},
			})
		}
	})

	if (lessonData.quizId) {
		blocks.push({
			type: 'quiz',
			data: {
				quiz: lessonData.quizId,
			},
		})
	}

	return blocks
}

const saveLesson = () => {
	editor.value.save().then((outputData) => {
		lesson.content = JSON.stringify(outputData)
		instructorEditor.value.save().then((outputData) => {
			lesson.instructor_content = JSON.stringify(outputData)
			if (lessonDetails.data?.lesson) {
				editCurrentLesson()
			} else {
				createNewLesson()
			}
		})
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
							lessonDetails.reload()
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

const editCurrentLesson = () => {
	editLesson.submit(
		{
			lesson: lessonDetails.data.lesson.name,
		},
		{
			validate() {
				return validateLesson()
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
			name: 'LessonForm',
			params: {
				courseName: props.courseName,
				chapterNumber: props.chapterNumber,
				lessonNumber: props.lessonNumber,
			},
		},
	})
	return crumbs
})

const pageMeta = computed(() => {
	return {
		title: 'Lesson Editor',
		description: 'Create and edit lessons for your course',
	}
})

updateDocumentTitle(pageMeta)
</script>
<style>
.embed-tool__caption,
.cdx-simple-image__caption {
	display: none;
}

.ce-block__content {
	max-width: none;
}

.ce-toolbar__content {
	max-width: none;
}

.codeBoxHolder {
	display: flex;
	flex-direction: column;
	justify-content: flex-start;
	align-items: flex-start;
}

.codeBoxTextArea {
	width: 100%;
	min-height: 30px;
	padding: 10px;
	border-radius: 2px 2px 2px 0;
	border: none !important;
	outline: none !important;
	font: 14px monospace;
}

.codeBoxSelectDiv {
	display: flex;
	flex-direction: column;
	justify-content: flex-start;
	align-items: flex-start;
	position: relative;
}

.codeBoxSelectInput {
	border-radius: 0 0 20px 2px;
	padding: 2px 26px;
	padding-top: 0;
	padding-right: 0;
	text-align: left;
	cursor: pointer;
	border: none !important;
	outline: none !important;
}

.codeBoxSelectDropIcon {
	position: absolute !important;
	left: 10px !important;
	bottom: 0 !important;
	width: unset !important;
	height: unset !important;
	font-size: 16px !important;
}

.codeBoxSelectPreview {
	display: none;
	flex-direction: column;
	justify-content: flex-start;
	align-items: flex-start;
	border-radius: 2px;
	box-shadow: 0 3px 15px -3px rgba(13, 20, 33, 0.13);
	position: absolute;
	top: 100%;
	margin: 5px 0;
	max-height: 30vh;
	overflow-x: hidden;
	overflow-y: auto;
	z-index: 10000;
}

.codeBoxSelectItem {
	width: 100%;
	padding: 5px 20px;
	margin: 0;
	cursor: pointer;
}

.codeBoxSelectItem:hover {
	opacity: 0.7;
}

.codeBoxSelectedItem {
	background-color: lightblue !important;
}

.codeBoxShow {
	display: flex !important;
}

.dark {
	color: #abb2bf;
	background-color: #282c34;
}

.light {
	color: #383a42;
	background-color: #fafafa;
}
</style>
