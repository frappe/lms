<template>
	<div class="p-3 h-full">
		<div
			v-if="!hideHeader && title && (outline.data?.length || allowEdit)"
			class="flex items-center justify-between gap-x-2 mb-4 px-2"
			:class="{
				'sticky top-0 z-10 bg-surface-white border-b px-3 py-2.5 sm:px-5':
					allowEdit,
			}"
		>
			<div
				class="font-semibold text-lg leading-5 text-ink-gray-9"
				:class="{ 'font-medium text-p-base': allowEdit }"
			>
				{{ __(title) }}
			</div>
			<Button size="sm" v-if="allowEdit" @click="openChapterModal()">
				<template #prefix>
					<Plus class="size-4 stroke-1.5" />
				</template>
				{{ __('Add') }}
			</Button>
		</div>
		<div
			v-if="allowEdit && outline.data && !outline.data.length"
			class="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center text-ink-gray-5 h-full"
		>
			<BookOpen class="size-8 stroke-1.5" />
			<div class="text-sm">{{ __('No chapters yet') }}</div>
			<Button @click="openChapterModal()">
				<template #prefix>
					<Plus class="size-4 stroke-1.5" />
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
				:disabled="!allowEdit"
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
							@select-lesson="(payload) => emit('select-lesson', payload)"
							@edit-chapter="openChapterModal"
							@delete-chapter="trashChapter"
							@delete-lesson="
								({ lesson, chapter: chapterName }) =>
									trashLesson(lesson, chapterName)
							"
							@move-lesson="updateOutline"
							@add-lesson="openLessonModalForAdd"
							@edit-lesson="openLessonModalForEdit"
						/>
					</div>
				</template>
			</Draggable>
		</div>
	</div>
	<ChapterModal
		v-if="user.data"
		v-model="showChapterModal"
		v-model:outline="outline"
		:course="courseName"
		:chapterDetail="currentChapter"
	/>
	<LessonModal
		v-if="user.data && lessonContext"
		v-model:show="showLessonModal"
		:course="courseName"
		:chapterName="lessonContext.chapterName"
		:lessonIdx="lessonContext.lessonIdx"
		:lessonDetail="lessonContext.lessonDetail"
		@created="onLessonCreated"
		@updated="onLessonUpdated"
	/>
</template>

<script setup lang="ts">
import { Button, createResource, toast } from 'frappe-ui'
import { inject, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import Draggable from 'vuedraggable'
import { BookOpen, Plus } from 'lucide-vue-next'
import ChapterModal from '@/components/Modals/ChapterModal.vue'
import LessonModal from '@/components/Modals/LessonModal.vue'
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
const { $dialog } = getCurrentInstance()!.appContext.config
	.globalProperties as {
	$dialog: DialogFn
}

const emit = defineEmits<{
	'select-lesson': [{ chapterNumber: string; lessonNumber: string }]
}>()

interface LessonModalContext {
	chapterName: string
	chapterIdx: number
	lessonIdx: number
	lessonDetail: {
		name?: string
		title?: string
		include_in_preview?: boolean | 0 | 1
	} | null
}

const showLessonModal = ref<boolean>(false)
const lessonContext = ref<LessonModalContext | null>(null)

function openLessonModalForAdd(payload: {
	chapter: OutlineChapter
	lessonIdx: number
}) {
	lessonContext.value = {
		chapterName: payload.chapter.name,
		chapterIdx: payload.chapter.idx,
		lessonIdx: payload.lessonIdx,
		lessonDetail: null,
	}
	showLessonModal.value = true
}

function openLessonModalForEdit(payload: {
	chapter: OutlineChapter
	lesson: OutlineLesson
}) {
	lessonContext.value = {
		chapterName: payload.chapter.name,
		chapterIdx: payload.chapter.idx,
		lessonIdx: Number(payload.lesson.number.split('-')[1]) || 1,
		lessonDetail: {
			name: payload.lesson.name,
			title: payload.lesson.title,
			include_in_preview: payload.lesson.include_in_preview,
		},
	}
	showLessonModal.value = true
}

function onLessonCreated(created: { name: string; number: string }) {
	outline.reload()
	const ctx = lessonContext.value
	if (!ctx) return
	const chapterNumber = String(ctx.chapterIdx)
	const lessonNumber = created.number
	if (props.inlineSelect) {
		emit('select-lesson', { chapterNumber, lessonNumber })
		return
	}
	if (props.editorLinks) {
		router.push({
			name: 'CourseDetail',
			params: { courseName: props.courseName },
			hash: '#course editor',
			query: {
				editLesson: `${chapterNumber}-${lessonNumber}`,
				lessonMode: 'edit',
			},
		})
	}
}

function onLessonUpdated(_payload: { name: string }) {
	outline.reload()
}

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
		toast.success(__('Lesson moved successfully'))
	},
})

const updateChapterIndex = createResource({
	url: 'lms.lms.api.update_chapter_index',
	makeParams(values: { chapter: string; course: string; idx: number }) {
		return values
	},
	onSuccess() {
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
})

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
					deleteLesson.submit({ lesson: lessonName, chapter: chapterName })
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
					deleteChapter.submit({ chapter: chapterName })
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
