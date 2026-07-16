<template>
	<div class="py-10">
		<div class="mx-10 space-y-6 px-20">
			<div class="flex items-center justify-between gap-3">
				<div class="flex items-center gap-3">
					<Switch v-model="lesson.include_in_preview" @change="markDirty" />
					<div class="flex items-center gap-1.5">
						<span class="text-p-base font-medium text-ink-gray-8">
							{{ __('Include in preview') }}
						</span>
						<Tooltip
							:text="
								__(
									'When on, anyone can preview this lesson without enrolling. Otherwise it is visible only to enrolled students.'
								)
							"
						>
							<span
								class="lucide-help-circle size-4 shrink-0 text-ink-gray-5"
							/>
						</Tooltip>
					</div>
				</div>
			</div>

			<textarea
				ref="titleRef"
				v-model="lesson.title"
				:placeholder="__('Lesson title')"
				rows="1"
				class="lesson-title w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-2xl font-bold leading-tight text-ink-gray-9 placeholder:text-ink-gray-4 focus:outline-none focus:ring-0"
				@input="onTitleInput"
			/>

			<details
				class="instructor-notes rounded-lg border border-outline-gray-2"
				@toggle="onInstructorNotesToggle"
			>
				<summary
					class="flex w-full cursor-pointer items-center gap-2 px-4 py-3 text-start"
				>
					<NotebookPen class="size-4 stroke-1.5 text-ink-gray-7" />
					<span class="text-p-base font-medium text-ink-gray-8">
						{{ __('Instructor notes') }}
					</span>
					<Badge
						variant="subtle"
						theme="gray"
						size="sm"
						:label="__('private')"
					/>
					<ChevronRight
						class="instructor-notes-chevron ms-auto size-4 stroke-2 text-ink-gray-5"
					/>
				</summary>
				<BlockEditor
					ref="instructorEditor"
					class="instructor-notes-editor border-t border-outline-gray-2 py-3"
					:uploadContext="instructorUploadContext"
					@change="markDirty"
				/>
			</details>

			<BlockEditor
				ref="editor"
				:uploadContext="contentUploadContext"
				@change="markDirty"
			/>
		</div>
	</div>
</template>
<script setup>
import {
	Badge,
	Button,
	Switch,
	createResource,
	toast,
	Tooltip,
} from 'frappe-ui'
import {
	reactive,
	computed,
	onMounted,
	inject,
	ref,
	nextTick,
	onBeforeUnmount,
} from 'vue'
import { ChevronRight, NotebookPen } from 'lucide-vue-next'
import { useDebounceFn } from '@vueuse/core'
import { enablePlyr, sanitizeEditorJs } from '@/utils'
import { hasEditorContent, shouldSkipLessonSave } from '@/utils/lessonForm'
import { hasVideoContent } from '@/utils/video'
import BlockEditor from '@/components/BlockEditor.vue'
import { useOnboarding, useTelemetry } from 'frappe-ui/frappe'
import {
	useKeyboardShortcuts,
	saveShortcut,
} from '@/composables/useKeyboardShortcuts'

const editor = ref(null)
const instructorEditor = ref(null)
const user = inject('$user')
const titleRef = ref(null)

function onTitleInput() {
	autoGrowTitle()
	markDirty({ fromTitle: true })
}

// EditorJS can't focus while the card is collapsed (display:none).
function onInstructorNotesToggle(event) {
	if (event.target.open) instructorEditor.value?.focus()
}

function autoGrowTitle() {
	const el = titleRef.value
	if (!el) return
	el.style.height = 'auto'
	el.style.height = `${el.scrollHeight}px`
}

// reactive so the upload block picks up `docname` once the lesson is saved.
const contentUploadContext = reactive({ docname: null, fieldname: 'content' })
const instructorUploadContext = reactive({
	docname: null,
	fieldname: 'instructor_content',
})
const { capture } = useTelemetry()
const { updateOnboardingStep } = useOnboarding('learning')

const emit = defineEmits(['saved'])

// True after initial render, so render()'s onChange doesn't autosave.
let initialLoadComplete = false

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

const isDirty = ref(false)
let isUnmounting = false
let lessonDeleted = false
function markDeleted() {
	lessonDeleted = true
}

const autoSave = useDebounceFn(() => {
	if (lessonDeleted) return
	if (isDirty.value && lessonDetails.data?.lesson) saveLesson()
}, 800)

function markDirty({ fromTitle = false } = {}) {
	if (lessonDeleted) return
	if (!lessonDetails.data?.lesson) return
	// render() fires onChange; gate non-title saves until loaded.
	if (!fromTitle && !initialLoadComplete) return
	isDirty.value = true
	// Capture block data now so a later flush persists latest, not stale.
	if (!fromTitle) captureEditors()
	autoSave()
}

defineExpose({
	saveLesson,
	markDeleted,
	isDirty,
	lessonHasVideo: () => lessonHasVideo.value,
	lessonName: () => lessonDetails.data?.lesson?.name,
	lessonTitle: () => lesson.title,
})

onMounted(() => {
	if (!user.data?.is_moderator && !user.data?.is_instructor) {
		window.location.href = '/login'
	}
	capture('lesson_form_opened')
	enablePlyr()
})

// ignoreTyping:false enables Ctrl+S in title; guard spares ProseMirror.
useKeyboardShortcuts({
	ignoreTyping: false,
	shortcuts: [
		{
			...saveShortcut(() => saveLesson()),
			guard: (e) => !e.target?.classList?.contains('ProseMirror'),
		},
	],
})

const lesson = reactive({
	title: '',
	include_in_preview: false,
	body: '',
	instructor_notes: '',
	content: '',
})

const lessonHasVideo = computed(() => hasVideoContent(lesson))

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
			lesson.include_in_preview = data?.lesson?.include_in_preview
				? true
				: false
			contentUploadContext.docname = data.lesson.name
			instructorUploadContext.docname = data.lesson.name
			nextTick(autoGrowTitle)
			Promise.all([addLessonContent(data), addInstructorNotes(data)]).then(
				() => {
					nextTick(() => {
						// Loaded content isn't user input; arm autosave after render.
						isDirty.value = false
						initialLoadComplete = true
						// A freshly created lesson opens empty as "Untitled lesson" —
						// focus the title so it can be named (and so the block editor
						// doesn't grab the caret out from under the title). Existing
						// lessons focus the body for content editing.
						if (!data.lesson.content && !data.lesson.body) {
							titleRef.value?.focus()
						} else {
							editor.value?.focus()
						}
					})
				}
			)
		}
	},
})

const addLessonContent = (data) => {
	// Editor can unmount mid-load; render() on a null ref throws.
	if (!editor.value) return Promise.resolve()
	// Return render promise so callers wait for blocks in DOM.
	return editor.value.isReady().then(() => {
		if (!editor.value) return
		if (data.lesson.content) {
			return editor.value.render(
				sanitizeEditorJs(JSON.parse(data.lesson.content))
			)
		} else if (data.lesson.body) {
			let blocks = convertToJSON(data.lesson)
			return editor.value.render({
				blocks: blocks,
			})
		}
	})
}

const addInstructorNotes = (data) => {
	if (!instructorEditor.value) return Promise.resolve()
	return instructorEditor.value.isReady().then(() => {
		if (!instructorEditor.value) return
		if (data.lesson.instructor_content) {
			return instructorEditor.value.render(
				sanitizeEditorJs(JSON.parse(data.lesson.instructor_content))
			)
		} else if (data.lesson.instructor_notes) {
			let blocks = convertToJSON(data.lesson)
			return instructorEditor.value.render({
				blocks: blocks,
			})
		}
	})
}

onBeforeUnmount(() => {
	isUnmounting = true
	// Flush unsaved edits before teardown; skip if deleted.
	if (lessonDeleted) return
	if (isDirty.value && lessonDetails.data?.lesson) saveLesson({ flush: true })
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

const convertToJSON = (lessonData) => {
	let blocks = []
	// Dedupe a video shared by the youtube field and body macro.
	const seenYoutube = new Set()
	const youtubeKey = (url) => url.split('/').pop().split('?')[0]
	const pushYoutube = (embedUrl) => {
		const key = youtubeKey(embedUrl)
		if (seenYoutube.has(key)) return
		seenYoutube.add(key)
		blocks.push({
			type: 'embed',
			data: { service: 'youtube', embed: embedUrl },
		})
	}
	if (lessonData.youtube) {
		let youtubeID = lessonData.youtube.split('/').pop()
		pushYoutube(`https://www.youtube.com/embed/${youtubeID}`)
	}
	lessonData.body.split('\n').forEach((block) => {
		if (block.includes('{{ YouTubeVideo')) {
			let youtubeID = block.match(/\(["']([^"']+?)["']\)/)[1]
			if (!youtubeID.includes('https://'))
				youtubeID = `https://www.youtube.com/embed/${youtubeID}`
			pushYoutube(youtubeID)
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
					file_type: video.split('.').pop(),
				},
			})
		} else if (block.includes('{{ Audio')) {
			let audio = block.match(/\(["']([^"']+?)["']\)/)[1]
			blocks.push({
				type: 'upload',
				data: {
					file_url: audio,
					file_type: audio.split('.').pop(),
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

// Stored body has real content? Lets title-only edits skip re-serialising.
const storedContentHasBody = () => {
	if (!lesson.content) return false
	try {
		return hasEditorContent(JSON.parse(lesson.content))
	} catch {
		return false
	}
}

// Editor destroyed mid-save can reject; degrade to null so persist still runs.
const serialise = (ed) =>
	ed ? Promise.resolve(ed.save()).catch(() => null) : Promise.resolve(null)

// Fold serialised editor output into lesson; return whether body has content.
const foldEditorData = (bodyData, notesData) => {
	// Editor gone or empty: keep stored content so we don't wipe the body.
	let bodyHasContent = storedContentHasBody()
	if (bodyData) {
		bodyData = removeEmptyBlocks(bodyData)
		bodyHasContent = hasEditorContent(bodyData)
		if (bodyHasContent) lesson.content = JSON.stringify(bodyData)
	}

	// Fold notes only after load, else the empty default wipes stored notes.
	if (initialLoadComplete && notesData) {
		notesData = removeEmptyBlocks(notesData)
		lesson.instructor_content = JSON.stringify(notesData)
		// Clear legacy field so removed notes don't reappear via fallback.
		lesson.instructor_notes = ''
	}

	return bodyHasContent
}

// Serialise live editors into lesson on @change, before any teardown race.
const captureEditors = async () => {
	if (lessonDeleted) return
	const [bodyData, notesData] = await Promise.all([
		serialise(editor.value),
		serialise(instructorEditor.value),
	])
	foldEditorData(bodyData, notesData)
}

function saveLesson({ flush = false } = {}) {
	// Serialise both editors concurrently before unmount destroys them.
	const bodyPromise = serialise(editor.value)
	const notesPromise = serialise(instructorEditor.value)

	Promise.all([bodyPromise, notesPromise]).then(([bodyData, notesData]) => {
		const bodyHasContent = foldEditorData(bodyData, notesData)

		// Skip when there's nothing to save — no title, no body.
		if (shouldSkipLessonSave(lesson.title, bodyHasContent)) return

		// During teardown only an explicit flush may persist.
		if (isUnmounting && !flush) return
		if (lessonDeleted) return
		if (lessonDetails.data?.lesson) {
			editCurrentLesson()
		} else {
			createNewLesson()
		}
	})
}

const removeEmptyBlocks = (outputData) => {
	let blocks = outputData.blocks.filter((block) => {
		return Object.keys(block.data).length > 0 || block.type == 'paragraph'
	})
	outputData.blocks = blocks
	return outputData
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
							if (user.data?.is_system_manager)
								updateOnboardingStep('create_first_lesson')

							capture('lesson_created')
							toast.success(__('Lesson created successfully'))
							isDirty.value = false
							emit('saved', { isNew: true })
							lessonDetails.reload()
						},
					}
				)
			},
			onError(err) {
				toast.error(err.messages?.[0] || err)
			},
		}
	)
}

const editCurrentLesson = () => {
	// Catch the re-thrown rejection: a save racing a delete 404s harmlessly.
	editLesson
		.submit(
			{
				lesson: lessonDetails.data.lesson.name,
			},
			{
				validate() {
					return validateLesson()
				},
				onSuccess() {
					isDirty.value = false
					emit('saved', {
						name: lessonDetails.data.lesson.name,
						title: lesson.title,
						include_in_preview: lesson.include_in_preview,
						isNew: false,
					})
				},
			}
		)
		.catch((err) => {
			if (lessonDeleted) return
			toast.error(err.messages?.[0] || err.message || err)
		})
}

const validateLesson = () => {
	if (!lesson.title) {
		return 'Title is required'
	}
}
</script>
<style>
/* Drop the default disclosure marker; rotate chevron via [open]. */
.instructor-notes > summary {
	list-style: none;
}
.instructor-notes > summary::-webkit-details-marker {
	display: none;
}
.instructor-notes-chevron {
	transition: transform 200ms;
}
.instructor-notes[open] .instructor-notes-chevron {
	transform: rotate(90deg);
}
[dir='rtl'] .instructor-notes:not([open]) .instructor-notes-chevron {
	transform: rotate(180deg);
}

/* Indent so EditorJS's left-gutter controls stay inside the card. */
.instructor-notes-editor .ce-block__content,
.instructor-notes-editor .ce-toolbar__content {
	margin-inline-start: 4.5rem;
}

/* Lift instructor editor so its + menu paints above the content editor. */
.instructor-notes-editor .codex-editor {
	z-index: 2;
}
</style>
