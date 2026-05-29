<template>
	<Disclosure v-slot="{ open }" :key="chapter.name" :defaultOpen="defaultOpen">
		<DisclosureButton class="flex items-center w-full p-2 group">
			<span
				:class="{
					'rotate-90': open,
					'rtl:rotate-180': !open,
					hidden: chapter.is_scorm_package,
					open: index == 1,
				}"
				class="lucide-chevron-right size-4 text-ink-gray-9 stroke-1 transform duration-200"
			/>
			<div
				class="ms-2 min-w-0 flex-1 text-start"
				:class="inlineSelect ? '' : 'flex items-baseline justify-between gap-3'"
				@click="redirectToChapter"
			>
				<div
					class="truncate text-base font-medium leading-5 text-ink-gray-9"
					:title="chapter.title"
				>
					{{ chapter.title }}
				</div>
				<div
					v-if="!chapter.is_scorm_package && chapter.lessons?.length"
					class="text-ink-gray-5 shrink-0"
					:class="inlineSelect ? 'mt-0.5 text-xs leading-4' : 'text-sm'"
				>
					{{ chapter.lessons.length }}
					{{ chapter.lessons.length === 1 ? __('lesson') : __('lessons') }}
				</div>
			</div>
			<div class="flex ms-auto gap-x-4 shrink-0">
				<Tooltip :text="__('Edit Chapter')" placement="bottom">
					<span
						v-if="allowEdit"
						@click.prevent="emit('edit-chapter', chapter)"
						class="lucide-file-pen-line size-4 text-ink-gray-9 invisible group-hover:visible"
					/>
				</Tooltip>
				<Tooltip :text="__('Delete Chapter')" placement="bottom">
					<span
						v-if="allowEdit"
						@click.prevent="emit('delete-chapter', chapter.name)"
						class="lucide-trash-2 size-4 text-ink-red-3 invisible group-hover:visible"
					/>
				</Tooltip>
			</div>
			<span
				v-if="chapter.is_scorm_package && isScormChapterComplete"
				class="lucide-check size-4 text-green-700"
			/>
		</DisclosureButton>
		<DisclosurePanel v-if="!chapter.is_scorm_package">
			<Draggable
				:list="chapter.lessons"
				:disabled="!allowEdit"
				item-key="name"
				group="items"
				@end="(e: DraggableEvent) => emit('move-lesson', e)"
				:data-chapter="chapter.name"
			>
				<template #item="{ element: lesson }">
					<div
						class="outline-lesson ps-8 py-2 pe-4 text-ink-gray-9"
						:class="isActiveLesson(lesson.number) ? 'bg-surface-gray-3' : ''"
					>
						<component
							:is="inlineSelect ? 'div' : 'router-link'"
							:to="inlineSelect ? undefined : lessonRoute(lesson)"
							:class="inlineSelect ? 'cursor-pointer' : ''"
							@click="onLessonClick(lesson)"
						>
							<div class="flex items-center text-sm leading-5 group">
								<MonitorPlay
									v-if="lesson.icon === 'icon-youtube'"
									class="h-4 w-4 stroke-1 me-2"
								/>
								<HelpCircle
									v-else-if="lesson.icon === 'icon-quiz'"
									class="h-4 w-4 stroke-1 me-2"
								/>
								<NotebookPen
									v-else-if="lesson.icon === 'icon-assignment'"
									class="h-4 w-4 stroke-1 me-2"
								/>
								<SquareCode
									v-else-if="lesson.icon === 'icon-code'"
									class="h-4 w-4 stroke-1 me-2"
								/>
								<FileText
									v-else-if="lesson.icon === 'icon-list'"
									class="h-4 w-4 text-ink-gray-9 stroke-1 me-2"
								/>
								{{ lesson.title }}
								<div v-if="allowEdit" class="ms-auto flex items-center gap-2">
									<Tooltip :text="__('Edit lesson')" placement="bottom">
										<FilePenLine
											@click.prevent="emit('edit-lesson', { chapter, lesson })"
											class="h-4 w-4 text-ink-gray-9 invisible group-hover:visible"
										/>
									</Tooltip>
									<Trash2
										@click.prevent="
											emit('delete-lesson', {
												lesson: lesson.name,
												chapter: chapter.name,
											})
										"
										class="h-4 w-4 text-ink-red-3 invisible group-hover:visible"
									/>
								</div>
								<Check
									v-if="lesson.is_complete"
									class="h-4 w-4 text-green-700 ms-2"
								/>
							</div>
						</component>
					</div>
				</template>
			</Draggable>
			<div v-if="allowEdit" class="flex mt-2 mb-4 ps-8">
				<Button @click="addLesson">
					{{ __('Add Lesson') }}
				</Button>
			</div>
		</DisclosurePanel>
	</Disclosure>
</template>

<script setup lang="ts">
import { Button, Tooltip, toast } from 'frappe-ui'
import { computed, inject } from 'vue'
import Draggable from 'vuedraggable'
import { Disclosure, DisclosureButton, DisclosurePanel } from '@headlessui/vue'
import {
	Check,
	FilePenLine,
	FileText,
	HelpCircle,
	MonitorPlay,
	NotebookPen,
	SquareCode,
	Trash2,
} from 'lucide-vue-next'
import { useRoute, useRouter } from 'vue-router'
import type { RouteLocationRaw } from 'vue-router'
import type { OutlineChapter, OutlineLesson, SessionUser } from '@/types/api'

interface DraggableEvent {
	item: { __draggable_context: { element: OutlineChapter | OutlineLesson } }
	from: { dataset: { chapter: string } }
	to: { dataset: { chapter: string } }
	newIndex: number
}

const props = withDefaults(
	defineProps<{
		chapter: OutlineChapter
		index: number
		courseName: string
		allowEdit?: boolean
		inlineSelect?: boolean
		editorLinks?: boolean
		selectedLessonNumber?: string
	}>(),
	{
		allowEdit: false,
		inlineSelect: false,
		editorLinks: false,
		selectedLessonNumber: '',
	}
)

const emit = defineEmits<{
	'select-lesson': [{ chapterNumber: string; lessonNumber: string }]
	'edit-chapter': [OutlineChapter]
	'delete-chapter': [string]
	'delete-lesson': [{ lesson: string; chapter: string }]
	'move-lesson': [DraggableEvent]
	'add-lesson': [{ chapter: OutlineChapter; lessonIdx: number }]
	'edit-lesson': [{ chapter: OutlineChapter; lesson: OutlineLesson }]
}>()

const route = useRoute()
const router = useRouter()
const user = inject<SessionUser>('$user')!

const defaultOpen = computed<boolean>(() => {
	const active = route.params.chapterNumber
	return active ? props.chapter.idx == Number(active) : props.chapter.idx == 1
})

const isScormChapterComplete = computed<boolean>(() =>
	Boolean(
		props.chapter.lessons?.length &&
			props.chapter.lessons.every((l) => l.is_complete)
	)
)

function isActiveLesson(lessonNumber: string): boolean {
	if (props.inlineSelect) return props.selectedLessonNumber === lessonNumber
	return (
		route.params.chapterNumber == lessonNumber.split('-')[0] &&
		route.params.lessonNumber == lessonNumber.split('-')[1]
	)
}

// Admins (editorLinks) deep-link into the in-page editor; everyone else
// opens the student view.
function lessonRoute(lesson: OutlineLesson): RouteLocationRaw {
	const [chapterNumber, lessonNumber] = lesson.number.split('-')
	if (props.editorLinks) {
		return {
			name: 'CourseDetail',
			params: { courseName: props.courseName },
			hash: '#course editor',
			query: { editLesson: lesson.number, lessonMode: 'edit' },
		}
	}
	return {
		name: 'Lesson',
		params: { courseName: props.courseName, chapterNumber, lessonNumber },
	}
}

function onLessonClick(lesson: OutlineLesson) {
	if (!props.inlineSelect) return
	emit('select-lesson', {
		chapterNumber: lesson.number.split('-')[0],
		lessonNumber: lesson.number.split('-')[1],
	})
}

function addLesson() {
	emit('add-lesson', {
		chapter: props.chapter,
		lessonIdx: (props.chapter.lessons?.length ?? 0) + 1,
	})
}

function redirectToChapter() {
	if (!props.chapter.is_scorm_package) return
	;(event as Event | undefined)?.preventDefault()
	if (props.allowEdit) return
	if (!user.data) {
		toast.success(__('Please enroll for this course to view this lesson'))
		return
	}
	router.push({
		name: 'SCORMChapter',
		params: {
			courseName: props.courseName,
			chapterName: props.chapter.name,
		},
	})
}
</script>
