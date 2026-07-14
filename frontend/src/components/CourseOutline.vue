<template>
	<div class="p-3 h-full">
		<div
			v-if="!hideHeader && title && (outline.data?.length || allowEdit)"
			class="flex items-center justify-between gap-x-2 mb-4 px-2"
			:class="{
				'sticky top-0 z-10 bg-surface-base border-b px-3 py-2.5 sm:px-5':
					allowEdit,
			}"
		>
			<div
				class="text-lg-semibold leading-5 text-ink-gray-9"
				:class="{ 'font-medium text-p-base': allowEdit }"
			>
				{{ __(title) }}
			</div>
			<Button size="sm" v-if="allowEdit" @click="openChapterModal()">
				<template #prefix>
					<span class="lucide-plus size-4" />
				</template>
				{{ __('Add') }}
			</Button>
		</div>
		<div
			v-if="allowEdit && outline.data && !outline.data.length"
			class="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center text-ink-gray-5 h-full"
		>
			<span class="lucide-book-open size-8" />
			<div class="text-sm">{{ __('No chapters yet') }}</div>
			<Button @click="openChapterModal()">
				<template #prefix>
					<span class="lucide-plus size-4" />
				</template>
				{{ __('Create chapter') }}
			</Button>
		</div>
		<div
			v-else
			:class="{
				'border-2 rounded-md py-2 px-2': showOutline && outline.data?.length,
			}"
		>
			<Draggable
				:list="outline.data"
				:disabled="!allowEdit || chapterRenaming"
				item-key="name"
				group="chapters"
				@end="updateChapterOrder"
			>
				<template #item="{ element: chapter, index }">
					<div class="chapter-item">
						<ChapterRow
							:chapter="chapter"
							:index="index"
							:courseName="courseName"
							:allowEdit="allowEdit"
							:inlineSelect="inlineSelect"
							:editorLinks="editorLinks"
							:selectedLessonNumber="selectedLessonNumber"
							:creatingLesson="creatingLessonChapter === chapter.name"
							@select-lesson="(payload) => emit('select-lesson', payload)"
							@edit-chapter="openChapterModal"
							@rename-chapter="renameChapter"
							@renaming-change="(v) => (chapterRenaming = v)"
							@delete-chapter="trashChapter"
							@delete-lesson="
								({ lesson, chapter: chapterName }) =>
									trashLesson(lesson, chapterName)
							"
							@move-lesson="updateOutline"
							@create-lesson="createLessonInline"
						/>
					</div>
				</template>
			</Draggable>
		</div>
	</div>
	<ChapterModal
		v-if="user.data"
		v-model="showChapterModal"
		:course="courseName"
		:chapterDetail="currentChapter"
		@created="outline.reload()"
		@updated="outline.reload()"
	/>
</template>

<script setup lang="ts">
import { Button, createResource, toast } from 'frappe-ui'
import { inject, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import Draggable from 'vuedraggable'

import ChapterModal from '@/components/Modals/ChapterModal.vue'
import ChapterRow from '@/components/ChapterRow.vue'
import type {
	OutlineChapter,
	OutlineLesson,
	Resource,
	SessionUser,
} from '@/types/api'

interface DraggableEvent {
	item: { __draggable_context: { element: OutlineChapter | OutlineLesson } }
	from: { dataset: { chapter: string } }
	to: { dataset: { chapter: string } }
	newIndex: number
}

interface DialogAction {
	label: string
	theme?: string
	variant?: string
	onClick: (close: () => void) => void
}
type DialogFn = (opts: {
	title: string
	message: string
	actions: DialogAction[]
}) => void

import { getCurrentInstance } from 'vue'
const user = inject<SessionUser>('$user')!
const router = useRouter()
const showChapterModal = ref<boolean>(false)
const currentChapter = ref<OutlineChapter | null>(null)
// True while a ChapterRow is in inline-rename mode — locks chapter drag.
const chapterRenaming = ref<boolean>(false)
const { $dialog } = getCurrentInstance()!.appContext.config
	.globalProperties as {
	$dialog: DialogFn
}

const emit = defineEmits<{
	'select-lesson': [{ chapterNumber: string; lessonNumber: string }]
	// Keyed delete signals so the parent can match the open lesson precisely. The
	// name is carried per emit (no shared slot), so concurrent deletes can't name
	// the wrong doc and an unrelated reload can't consume the signal.
	'lesson-deleted': [{ lesson: string }]
	'chapter-deleted': [{ chapter: string }]
}>()

// The lesson currently being named inline (its docname), and the chapter whose
// "Add Lesson" button is mid-create (for the button spinner).
const creatingLessonChapter = ref<string>('')

const props = withDefaults(
	defineProps<{
		courseName: string
		showOutline?: boolean
		title?: string
		allowEdit?: boolean
		getProgress?: boolean
		completedLesson?: string | null
		inlineSelect?: boolean
		editorLinks?: boolean
		selectedLessonNumber?: string
		hideHeader?: boolean
	}>(),
	{
		showOutline: false,
		title: '',
		allowEdit: false,
		getProgress: false,
		inlineSelect: false,
		editorLinks: false,
		selectedLessonNumber: '',
		completedLesson: null,
		hideHeader: false,
	}
)

defineExpose({ openChapterModal })

const outline = createResource({
	url: 'lms.lms.utils.get_course_outline',
	cache: ['course_outline', props.courseName],
	makeParams() {
		return { course: props.courseName, progress: props.getProgress }
	},
	auto: true,
}) as Resource<OutlineChapter[] | null>

watch(
	() => props.courseName,
	() => outline.reload()
)

watch(
	() => props.completedLesson,
	(lessonName) => {
		if (!lessonName || !outline.data) return
		for (const chapter of outline.data) {
			const found = chapter.lessons?.find((l) => l.name === lessonName)
			if (found) {
				found.is_complete = true
				break
			}
		}
	}
)

const deleteLesson = createResource({
	url: 'lms.lms.api.delete_lesson',
	makeParams(values: { lesson: string; chapter: string }) {
		return values
	},
	onSuccess() {
		outline.reload()
		toast.success(__('Lesson deleted successfully'))
	},
	onError(err: { messages?: string[] } | string) {
		toast.error(
			typeof err === 'string' ? err : err.messages?.[0] ?? __('Error')
		)
	},
})

const updateLessonIndex = createResource({
	url: 'lms.lms.api.update_lesson_index',
	makeParams(values: {
		lesson: string
		sourceChapter: string
		targetChapter: string
		idx: number
	}) {
		return values
	},
	onSuccess() {
		outline.reload()
		toast.success(__('Lesson moved successfully'))
	},
})

const updateChapterIndex = createResource({
	url: 'lms.lms.api.update_chapter_index',
	makeParams(values: { chapter: string; course: string; idx: number }) {
		return values
	},
	onSuccess() {
		outline.reload()
		toast.success(__('Chapter moved successfully'))
	},
})

const deleteChapter = createResource({
	url: 'lms.lms.api.delete_chapter',
	makeParams(values: { chapter: string }) {
		return values
	},
	onSuccess() {
		outline.reload()
		toast.success(__('Chapter deleted successfully'))
	},
	onError(err: { messages?: string[] } | string) {
		toast.error(
			typeof err === 'string' ? err : err.messages?.[0] ?? __('Error')
		)
	},
})

const renameChapterResource = createResource({
	url: 'lms.lms.api.upsert_chapter',
	makeParams(values: { chapter: OutlineChapter; title: string }) {
		return {
			name: values.chapter.name,
			title: values.title,
			course: props.courseName,
			is_scorm_package: values.chapter.is_scorm_package ?? 0,
			scorm_package: values.chapter.scorm_package ?? null,
		}
	},
	onSuccess() {
		outline.reload()
		toast.success(__('Chapter renamed successfully'))
	},
	onError(err: { messages?: string[] } | string) {
		outline.reload()
		toast.error(typeof err === 'string' ? err : err.messages?.[0] ?? 'Error')
	},
})

function renameChapter(payload: { chapter: OutlineChapter; title: string }) {
	renameChapterResource.submit(payload)
}

const errorMessage = (err: { messages?: string[] } | string): string =>
	typeof err === 'string' ? err : err.messages?.[0] ?? 'Error'

// Inserts the Course Lesson and its chapter reference in one request, so a
// failure on either rolls back atomically — no orphaned lesson. Returns the
// new lesson's docname.
const addLesson = createResource({
	url: 'lms.lms.api.create_lesson',
	makeParams(values: { chapter: string }) {
		return { chapter: values.chapter }
	},
})

// Create the lesson immediately as "Untitled lesson", then open it in the
// editor so the title is edited inline on the lesson itself.
function createLessonInline(payload: {
	chapter: OutlineChapter
	lessonIdx: number
}) {
	creatingLessonChapter.value = payload.chapter.name
	addLesson.submit(
		{ chapter: payload.chapter.name },
		{
			onSuccess(lessonName: string) {
				creatingLessonChapter.value = ''
				outline.reload().then(() => {
					const created = (outline.data ?? [])
						.flatMap((c) => c.lessons ?? [])
						.find((l) => l.name === lessonName)
					if (created) navigateToLesson(created)
				})
			},
			onError(err: { messages?: string[] } | string) {
				creatingLessonChapter.value = ''
				toast.error(errorMessage(err))
			},
		}
	)
}

function navigateToLesson(lesson: OutlineLesson) {
	const [chapterNumber, lessonNumber] = lesson.number.split('-')
	if (props.inlineSelect) {
		emit('select-lesson', { chapterNumber, lessonNumber })
		return
	}
	if (props.editorLinks) {
		router.push({
			name: 'CourseDetail',
			params: { courseName: props.courseName },
			hash: '#course editor',
			query: { editLesson: lesson.number, lessonMode: 'edit' },
		})
	}
}

function trashLesson(lessonName: string, chapterName: string) {
	$dialog({
		title: __('Delete this lesson?'),
		message: __(
			'Deleting this lesson will permanently remove it from the course. This action cannot be undone. Are you sure you want to continue?'
		),
		actions: [
			{
				label: __('Delete'),
				theme: 'red',
				variant: 'solid',
				onClick(close) {
					// Per-call onSuccess closes over this lessonName, so the editor is
					// told exactly which lesson went — no shared slot to drift on
					// concurrent deletes. Runs alongside the resource-level reload.
					deleteLesson.submit(
						{ lesson: lessonName, chapter: chapterName },
						{ onSuccess: () => emit('lesson-deleted', { lesson: lessonName }) }
					)
					close()
				},
			},
		],
	})
}

function trashChapter(chapterName: string) {
	$dialog({
		title: __('Delete this chapter?'),
		message: __(
			'Deleting this chapter will also delete all its lessons and permanently remove it from the course. This action cannot be undone. Are you sure you want to continue?'
		),
		actions: [
			{
				label: __('Delete'),
				theme: 'red',
				variant: 'solid',
				onClick(close) {
					deleteChapter.submit(
						{ chapter: chapterName },
						{
							onSuccess: () =>
								emit('chapter-deleted', { chapter: chapterName }),
						}
					)
					close()
				},
			},
		],
	})
}

function openChapterModal(chapter: OutlineChapter | null = null) {
	currentChapter.value = chapter
	showChapterModal.value = true
}

function updateOutline(e: DraggableEvent) {
	updateLessonIndex.submit({
		lesson: e.item.__draggable_context.element.name,
		sourceChapter: e.from.dataset.chapter,
		targetChapter: e.to.dataset.chapter,
		idx: e.newIndex,
	})
}

function updateChapterOrder(e: DraggableEvent) {
	updateChapterIndex.submit({
		chapter: e.item.__draggable_context.element.name,
		course: props.courseName,
		idx: e.newIndex,
	})
}
</script>
