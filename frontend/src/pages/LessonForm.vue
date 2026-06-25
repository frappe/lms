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
// Set once the component is tearing down, so an in-flight debounced autosave that
// only resolves during teardown doesn't persist a stale (possibly deleted)
// lesson — only the explicit unmount flush may persist then.
let isUnmounting = false
// Set when the open lesson is deleted elsewhere: CourseEditor's stale-selection
// watcher calls markDeleted() before this form unmounts. Suppresses every
// autosave/flush path so we never set_value a document that no longer exists.
let lessonDeleted = false
function markDeleted() {
	lessonDeleted = true
}

// Debounced so a burst of keystrokes collapses into a single save shortly
// after the user pauses. Gate on a still-loaded, undeleted lesson: if it was
// deleted while the debounce was pending, saveLesson would write to the gone
// document (or hit createNewLesson and resurrect it).
const autoSave = useDebounceFn(() => {
	if (lessonDeleted) return
	if (isDirty.value && lessonDetails.data?.lesson) saveLesson()
}, 800)

function markDirty({ fromTitle = false } = {}) {
	if (lessonDeleted) return
	if (!lessonDetails.data?.lesson) return
	// The editor fires onChange during programmatic render() too, so gate those
	// on initialLoadComplete to avoid a spurious autosave on load. Title @input
	// is always real user input (a programmatic v-model set doesn't fire it), so
	// it arms autosave even before the editors finish their initial render.
	if (!fromTitle && !initialLoadComplete) return
	isDirty.value = true
	// An editor change carries new block data — capture it into the local lesson
	// now, while the editor is alive, so an unmount flush whose save() rejects
	// mid-destroy still persists this edit rather than stale content. A title edit
	// carries no block data, so there's nothing to serialise there.
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

// ignoreTyping: false so Cmd/Ctrl+S saves from the title field, but the guard
// keeps the rich-text editor's own behaviour intact (matches the prior handler).
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
	// The editor component can unmount mid-load (fast nav / lesson delete), so
	// guard both the entry and inside the isReady().then() — the ref can go null
	// between them, and render() on null throws.
	if (!editor.value) return Promise.resolve()
	// Return the render promise so callers (autosave arming, autofocus) wait for
	// the blocks to actually be in the DOM, not just for render() to be called.
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
	// Best-effort flush of any unsaved edits before the editors are destroyed.
	// Skip when the lesson was deleted — flushing would set_value a gone document
	// (or resurrect it via createNewLesson). flush:true so a genuine navigate-away
	// flush isn't suppressed by the in-flight-autosave teardown guard.
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

// Whether the already-stored (serialised) lesson body has real content. Used
// when the live body editor is unavailable so a title-only edit can still be
// persisted without re-serialising — or wiping — the body.
const storedContentHasBody = () => {
	if (!lesson.content) return false
	try {
		return hasEditorContent(JSON.parse(lesson.content))
	} catch {
		return false
	}
}

// .catch(() => null): an editor whose EditorJS instance is being destroyed
// mid-save can reject. Without this Promise.all would reject and the whole
// persist — including the stored-content fallback and the staged title — is
// skipped, silently dropping the edit on navigation. A rejected save degrades to
// "editor unavailable" (null), so the lesson is still written from whatever was
// last captured.
const serialise = (ed) =>
	ed ? Promise.resolve(ed.save()).catch(() => null) : Promise.resolve(null)

// Fold freshly-serialised editor output into the local lesson, applying the same
// guards the persist path needs, and return whether the body (fresh or stored)
// has real content. Shared by the persist path and the on-change capture so
// lesson.content / instructor_content stay current even before a persist runs —
// which is what lets a teardown flush whose save() rejects still write the latest
// edits instead of stale initial-load content.
const foldEditorData = (bodyData, notesData) => {
	// Body: if the editor was gone (torn down mid-flush) or resolved null, we
	// can't re-serialise it — fall back to the stored content for the skip check
	// and leave lesson.content untouched so a staged title edit still persists.
	// Otherwise only overwrite stored content when the body has real content: a
	// transient/empty editor (hot-reload remount, render race, mid lesson-switch)
	// serialises to just an empty paragraph and must not wipe what's saved.
	let bodyHasContent = storedContentHasBody()
	if (bodyData) {
		bodyData = removeEmptyBlocks(bodyData)
		bodyHasContent = hasEditorContent(bodyData)
		if (bodyHasContent) lesson.content = JSON.stringify(bodyData)
	}

	// Instructor notes: fold in only once the editor has loaded its saved notes
	// (initialLoadComplete). A capture/autosave can fire before then (a title
	// @input arms autosave ahead of the editors finishing render), at which point
	// notesEditor.save() returns its empty default — folding that would wipe an
	// existing lesson's stored notes. Before load, and when the editor has torn
	// down (notesData null), keep the stored instructor_content.
	if (initialLoadComplete && notesData) {
		notesData = removeEmptyBlocks(notesData)
		lesson.instructor_content = JSON.stringify(notesData)
		// instructor_content is now the source of truth; clear the legacy
		// instructor_notes field so removed notes don't reappear on the lesson
		// page via the fallback render path.
		lesson.instructor_notes = ''
	}

	return bodyHasContent
}

// Serialise the live editors into the local lesson without persisting. Runs on
// every editor @change, while the editors are still alive (no teardown race), so
// a later unmount flush whose save() rejects mid-destroy still has the latest
// content folded in. Without this, a rejected teardown save falls back to the
// stale initial-load content, and the persist below reports success while
// dropping the user's most recent edits.
const captureEditors = async () => {
	if (lessonDeleted) return
	const [bodyData, notesData] = await Promise.all([
		serialise(editor.value),
		serialise(instructorEditor.value),
	])
	foldEditorData(bodyData, notesData)
}

function saveLesson({ flush = false } = {}) {
	// Capture both editors and kick off their serialisation up front, while both
	// are still alive. During an unmount flush Vue destroys the child editors
	// right after this returns, so the old body-then-instructor chain ran the
	// instructor save() against an already-null editor and silently dropped the
	// notes. Serialise concurrently so a dirty unmount captures both.
	const bodyPromise = serialise(editor.value)
	const notesPromise = serialise(instructorEditor.value)

	Promise.all([bodyPromise, notesPromise]).then(([bodyData, notesData]) => {
		const bodyHasContent = foldEditorData(bodyData, notesData)

		// Skip only when there's nothing worth saving — no title and no body.
		if (shouldSkipLessonSave(lesson.title, bodyHasContent)) return

		// During teardown, only the explicit unmount flush may persist. A debounced
		// autosave already in flight when the lesson was deleted/left must not write
		// a stale (possibly deleted) document.
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
