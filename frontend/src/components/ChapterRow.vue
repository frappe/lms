<template>
	<Disclosure v-slot="{ open }" :key="chapter.name" :defaultOpen="defaultOpen">
		<DisclosureButton class="flex items-center w-full p-2 group">
			<span
				:class="{
					'rotate-90': open,
					'rtl:rotate-180': !open,
					hidden: chapter.is_scorm_package,
					open: index == 1,
					'self-start mt-0.5': inlineSelect,
				}"
				class="lucide-chevron-right size-4 text-ink-gray-9 stroke-1 transform duration-200"
			/>
			<div
				class="ms-2 min-w-0 flex-1 text-start"
				:class="inlineSelect ? '' : 'flex items-baseline justify-between gap-3'"
				@click="redirectToChapter"
			>
				<Input
					v-if="isRenaming"
					ref="renameInput"
					v-model="renameValue"
					class="w-full"
					@click.stop.prevent
					@keydown.enter="commitRename"
					@keydown.esc="cancelRename"
					@blur="commitRename"
				/>
				<div
					v-else
					class="truncate text-base-medium leading-5 text-ink-gray-9"
					:title="chapter.title"
					@dblclick="allowEdit && !chapter.is_scorm_package && startRename()"
				>
					{{ chapter.title }}
				</div>
			</div>
			<div class="flex ms-3 items-center gap-x-4 shrink-0">
				<!-- Lesson count in the corner (student-view style). When the chapter
				is editable it gives way to the delete action on hover. -->
				<span
					v-if="!chapter.is_scorm_package && chapter.lessons?.length"
					class="text-sm text-ink-gray-5"
					:class="{ 'group-hover:hidden': allowEdit }"
				>
					{{ chapter.lessons.length }}
				</span>
				<Tooltip :text="__('Edit Chapter')" placement="bottom">
					<span
						v-if="allowEdit && chapter.is_scorm_package"
						@click.prevent="emit('edit-chapter', chapter)"
						class="lucide-file-pen-line size-4 text-ink-gray-9 invisible group-hover:visible"
					/>
				</Tooltip>
				<Tooltip :text="__('Delete Chapter')" placement="bottom">
					<span
						v-if="allowEdit"
						@click.prevent="emit('delete-chapter', chapter.name)"
						class="lucide-trash-2 size-4 text-ink-red-6 hidden group-hover:inline-block"
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
						:class="
							isActiveLesson(lesson.number)
								? 'bg-surface-gray-3 rounded-md'
								: ''
						"
					>
						<component
							:is="inlineSelect ? 'div' : 'router-link'"
							:to="inlineSelect ? undefined : lessonRoute(lesson)"
							:class="inlineSelect ? 'cursor-pointer' : ''"
							@click="onLessonClick(lesson)"
						>
							<div class="flex items-center text-sm leading-5 group">
								<span
									v-if="lesson.icon === 'icon-youtube'"
									class="lucide-monitor-play h-4 w-4 me-2"
								/>
								<span
									v-else-if="lesson.icon === 'icon-quiz'"
									class="lucide-help-circle h-4 w-4 me-2"
								/>
								<span
									v-else-if="lesson.icon === 'icon-assignment'"
									class="lucide-notebook-pen h-4 w-4 me-2"
								/>
								<span
									v-else-if="lesson.icon === 'icon-code'"
									class="lucide-square-code h-4 w-4 me-2"
								/>
								<span
									v-else-if="lesson.icon === 'icon-list'"
									class="lucide-file-text h-4 w-4 text-ink-gray-9 me-2"
								/>
								{{ lesson.title }}
								<div v-if="allowEdit" class="ms-auto flex items-center gap-2">
									<span
										@click.prevent="
											emit('delete-lesson', {
												lesson: lesson.name,
												chapter: chapter.name,
											})
										"
										class="lucide-trash-2 h-4 w-4 text-ink-red-6 invisible group-hover:visible"
									/>
								</div>
								<span
									v-if="lesson.is_complete"
									class="lucide-check h-4 w-4 text-green-700 ms-2"
								/>
							</div>
						</component>
					</div>
				</template>
			</Draggable>
			<div v-if="allowEdit" class="flex mt-2 mb-4 ps-8">
				<Button :loading="creatingLesson" @click="addLesson">
					<template #prefix>
						<span class="lucide-plus size-4" />
					</template>
					{{ __('Add Lesson') }}
				</Button>
			</div>
		</DisclosurePanel>
	</Disclosure>
</template>

<script setup lang="ts">
import { Button, Input, Tooltip, toast } from 'frappe-ui'
import { computed, inject, nextTick, ref, watch } from 'vue'
import Draggable from 'vuedraggable'
import { Disclosure, DisclosureButton, DisclosurePanel } from '@headlessui/vue'
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
		creatingLesson?: boolean
	}>(),
	{
		allowEdit: false,
		inlineSelect: false,
		editorLinks: false,
		selectedLessonNumber: '',
		creatingLesson: false,
	}
)

const emit = defineEmits<{
	'select-lesson': [{ chapterNumber: string; lessonNumber: string }]
	'edit-chapter': [OutlineChapter]
	'rename-chapter': [{ chapter: OutlineChapter; title: string }]
	'renaming-change': [boolean]
	'delete-chapter': [string]
	'delete-lesson': [{ lesson: string; chapter: string }]
	'move-lesson': [DraggableEvent]
	'create-lesson': [{ chapter: OutlineChapter; lessonIdx: number }]
}>()

const route = useRoute()
const router = useRouter()
const user = inject<SessionUser>('$user')!

const isRenaming = ref<boolean>(false)
const renameValue = ref<string>('')
const renameInput = ref<{ $el: HTMLElement } | null>(null)

// Tell the parent outline to lock chapter dragging while a name is being edited,
// so a stray drag can't fire mid-rename.
watch(isRenaming, (renaming) => emit('renaming-change', renaming))

function startRename(): void {
	renameValue.value = props.chapter.title
	isRenaming.value = true
	nextTick(() => {
		renameInput.value?.$el.querySelector('input')?.focus()
	})
}

function commitRename(): void {
	if (!isRenaming.value) return
	isRenaming.value = false
	const title = renameValue.value.trim()
	if (!title || title === props.chapter.title) return
	emit('rename-chapter', { chapter: props.chapter, title })
}

function cancelRename(): void {
	isRenaming.value = false
	renameValue.value = props.chapter.title
}

const defaultOpen = computed<boolean>(() => {
	// Which chapter is expanded on (re)mount. The student lesson view carries
	// the active lesson in route params; the in-page editor carries it in
	// ?editLesson ("<chapter>-<lesson>") — which survives navigating away and
	// back — with selectedLessonNumber as a fallback. Default to the first
	// chapter only when nothing is active.
	const editChapter =
		typeof route.query.editLesson === 'string'
			? route.query.editLesson.split('-')[0]
			: ''
	const active =
		route.params.chapterNumber ||
		editChapter ||
		props.selectedLessonNumber.split('-')[0]
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
	emit('create-lesson', {
		chapter: props.chapter,
		lessonIdx: (props.chapter.lessons?.length ?? 0) + 1,
	})
}

function redirectToChapter() {
	if (!props.chapter.is_scorm_package) return
	;(event as Event | undefined)?.preventDefault()
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
