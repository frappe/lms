<template>
	<div class="py-10">
		<div class="mx-10 space-y-6 px-20">
			<!-- Include-in-preview control row -->
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

			<!-- Inline-editable lesson title -->
			<textarea
				ref="titleRef"
				v-model="lesson.title"
				:placeholder="__('Lesson title')"
				rows="1"
				class="lesson-title w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-3xl font-bold leading-tight text-ink-gray-9 placeholder:text-ink-gray-4 focus:outline-none focus:ring-0"
				@input="onTitleInput"
			/>

			<!-- Instructor notes card (native disclosure) -->
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

			<!-- Lesson content -->
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
import { hasEditorContent } from '@/utils/lessonForm'
import { hasVideoContent } from '@/utils/video'
import BlockEditor from '@/components/BlockEditor.vue'
import { useOnboarding, useTelemetry } from 'frappe-ui/frappe'

const editor = ref(null)
const instructorEditor = ref(null)
const user = inject('$user')
const titleRef = ref(null)

function onTitleInput() {
	autoGrowTitle()
	markDirty()
}

// Put the caret in the instructor-notes editor when the card is opened, so it's
// ready to type. EditorJS can't focus while the <details> is collapsed
// (display: none), so this has to wait for the open toggle.
function onInstructorNotesToggle(event) {
	if (event.target.open) instructorEditor.value?.focus()
}

function autoGrowTitle() {
	const el = titleRef.value
	if (!el) return
	el.style.height = 'auto'
	el.style.height = `${el.scrollHeight}px`
}

const contentUploadContext = { docname: null, fieldname: 'content' }
const instructorUploadContext = {
	docname: null,
	fieldname: 'instructor_content',
}
const { capture } = useTelemetry()
const { updateOnboardingStep } = useOnboarding('learning')

const emit = defineEmits(['saved'])

// Set true only once the initial content has finished rendering, so the
// onChange events EditorJS fires during programmatic render() don't trigger a
// spurious autosave on load.
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

// Debounced so a burst of keystrokes collapses into a single save shortly
// after the user pauses.
const autoSave = useDebounceFn(() => {
	if (isDirty.value) saveLesson()
}, 800)

function markDirty() {
	if (!lessonDetails.data?.lesson || !initialLoadComplete) return
	isDirty.value = true
	autoSave()
}

defineExpose({
	saveLesson,
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
	window.addEventListener('keydown', keyboardShortcut)
	enablePlyr()
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
						// Initial population isn't user input; only arm autosave
						// once the editors have rendered the loaded content.
						isDirty.value = false
						initialLoadComplete = true
						// Blinking caret ready in the lesson body on open.
						editor.value?.focus()
					})
				}
			)
		}
	},
})

const addLessonContent = (data) => {
	// Return the render promise so callers (autosave arming, autofocus) wait for
	// the blocks to actually be in the DOM, not just for render() to be called.
	return editor.value.isReady().then(() => {
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
	return instructorEditor.value.isReady().then(() => {
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

const keyboardShortcut = (e) => {
	if (
		e.key === 's' &&
		(e.ctrlKey || e.metaKey) &&
		!e.target.classList.contains('ProseMirror')
	) {
		saveLesson()
		e.preventDefault()
	}
}

onBeforeUnmount(() => {
	// Best-effort flush of any unsaved edits before the editors are destroyed.
	if (isDirty.value) saveLesson()
	window.removeEventListener('keydown', keyboardShortcut)
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
	// A lesson can carry the same video in BOTH the `youtube` field and a
	// `{{ YouTubeVideo }}` body macro. Without de-duping we'd emit two embed
	// blocks for one video — the symptom being a stuck preloader above a second
	// player. Key on the video id so each video renders exactly once.
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

function saveLesson() {
	// The debounced autosave can fire as the component tears down; bail if the
	// editors are already gone.
	if (!editor.value || !instructorEditor.value) return
	editor.value.save().then((outputData) => {
		outputData = removeEmptyBlocks(outputData)
		// Guard against wiping a lesson: a transient/empty editor (hot-reload
		// remount, render race, mid lesson-switch) serialises to just an empty
		// paragraph. Refuse to overwrite stored content with a blank doc. A
		// genuinely new lesson with real content still has blocks, so this only
		// blocks blank saves — which validateLesson would reject anyway.
		if (!hasEditorContent(outputData)) return
		lesson.content = JSON.stringify(outputData)
		instructorEditor.value.save().then((outputData) => {
			outputData = removeEmptyBlocks(outputData)
			lesson.instructor_content = JSON.stringify(outputData)
			// instructor_content is now the source of truth; clear the legacy
			// instructor_notes field so removed notes don't reappear on the
			// lesson page via the fallback render path.
			lesson.instructor_notes = ''
			if (lessonDetails.data?.lesson) {
				editCurrentLesson()
			} else {
				createNewLesson()
			}
		})
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
	editLesson.submit(
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
			onError(err) {
				toast.error(err.message)
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
</script>
<style>
/* Native <details> disclosure: drop the default marker triangle and drive the
   chevron rotation off the [open] state instead of a JS toggle. */
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

/* Indent the instructor-notes editor so EditorJS's block controls (the +
   add button and drag handle, which live in the left gutter and span ~70px)
   sit fully inside the bordered card instead of spilling into the page
   margin. Scoped so the full-width content editor is unaffected. */
.instructor-notes-editor .ce-block__content,
.instructor-notes-editor .ce-toolbar__content {
	margin-inline-start: 4.5rem;
}

/* Both editors are .codex-editor siblings with z-index: 1, so the content
   editor (later in the DOM) paints over the instructor editor's popovers —
   the popover's z-index: 4 is trapped inside its editor's stacking context.
   Lift the instructor editor one level so its + menu renders on top. */
.instructor-notes-editor .codex-editor {
	z-index: 2;
}
</style>
