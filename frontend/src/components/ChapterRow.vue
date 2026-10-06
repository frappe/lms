<template>
	<Disclosure v-slot="{ open }" :key="chapter.name" :defaultOpen="defaultOpen">
		<div class="flex items-center w-full group">
			<component
				:is="headerComponent"
				v-bind="headerProps"
				class="flex items-center w-full min-w-0 p-2 text-start"
			>
				<span
					:class="{
						'rotate-90': open,
						'rtl:rotate-180': !open,
						hidden: chapter.is_scorm_package,
						'self-start mt-0.5': inlineSelect,
					}"
					class="lucide-chevron-right size-4 text-ink-gray-9 transform duration-200"
				/>
				<div
					class="ms-2 min-w-0 flex-1 text-start"
					:class="[
						inlineSelect ? '' : 'flex items-baseline justify-between gap-3',
						isScormChapterLocked ? 'cursor-not-allowed opacity-60' : '',
					]"
				>
					<TextInput
						v-if="isRenaming"
						ref="renameInput"
						v-model="renameValue"
						class="w-full"
						@click.stop.prevent
						@keydown.enter.stop.prevent="commitRename"
						@keydown.esc.stop.prevent="cancelRename"
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
				<span
					v-if="!chapter.is_scorm_package && chapter.lessons?.length"
					class="ms-3 shrink-0 text-sm text-ink-gray-6"
					:class="{
						'group-hover:hidden group-focus-within:hidden [@media(hover:none)]:hidden':
							allowEdit,
					}"
				>
					{{ chapter.lessons.length }}
				</span>
				<template v-if="isScormChapterLocked">
					<span
						class="lucide-lock-keyhole size-4 text-ink-gray-4"
						:title="__('Complete the previous lessons to unlock this one')"
						aria-hidden="true"
					/>
					<span class="sr-only">{{ __('Locked') }}</span>
				</template>
				<template
					v-else-if="chapter.is_scorm_package && isScormChapterComplete"
				>
					<span
						class="lucide-check size-4 text-ink-green-8"
						aria-hidden="true"
					/>
					<span class="sr-only">{{ __('Completed') }}</span>
				</template>
			</component>
			<div v-if="allowEdit" class="flex items-center gap-x-4 shrink-0">
				<Tooltip
					v-if="chapter.is_scorm_package"
					:text="__('Edit Chapter')"
					side="bottom"
				>
					<Button
						variant="ghost"
						:label="__('Edit Chapter')"
						class="invisible group-hover:visible group-focus-within:visible [@media(hover:none)]:visible"
						@click="emit('edit-chapter', chapter)"
					>
						<template #icon>
							<span class="lucide-file-pen-line size-4 text-ink-gray-9" />
						</template>
					</Button>
				</Tooltip>
				<Tooltip :text="__('Delete Chapter')" side="bottom">
					<Button
						variant="ghost"
						:label="__('Delete Chapter')"
						class="me-2 hidden group-hover:inline-flex group-focus-within:inline-flex [@media(hover:none)]:inline-flex"
						@click="emit('delete-chapter', chapter.name)"
					>
						<template #icon>
							<span class="lucide-trash-2 size-4 text-ink-red-5" />
						</template>
					</Button>
				</Tooltip>
			</div>
		</div>
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
						class="ps-8 py-2 pe-4 text-ink-gray-9 flex items-center group"
						data-testid="outline-lesson"
						:class="
							isActiveLesson(lesson.number) ? 'bg-surface-gray-3 rounded-5' : ''
						"
					>
						<component
							:is="
								lesson.locked ? 'div' : inlineSelect ? 'button' : 'router-link'
							"
							:type="!lesson.locked && inlineSelect ? 'button' : undefined"
							:to="
								inlineSelect || lesson.locked ? undefined : lessonRoute(lesson)
							"
							class="flex-1 min-w-0"
							:class="
								lesson.locked
									? 'cursor-not-allowed opacity-60'
									: inlineSelect
									? 'cursor-pointer w-full text-start'
									: ''
							"
							@click="onLessonClick(lesson)"
						>
							<div class="flex items-center text-sm leading-5">
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
								<template v-if="lesson.locked">
									<span
										class="lucide-lock-keyhole h-4 w-4 text-ink-gray-4 ms-2"
										:title="
											__('Complete the previous lesson to unlock this one')
										"
										aria-hidden="true"
									/>
									<span class="sr-only">{{ __('Locked') }}</span>
								</template>
								<template v-else-if="lesson.is_complete">
									<span
										class="lucide-check h-4 w-4 text-ink-green-8 ms-2"
										aria-hidden="true"
									/>
									<span class="sr-only">{{ __('Completed') }}</span>
								</template>
							</div>
						</component>
						<div v-if="allowEdit" class="ms-auto flex items-center gap-2">
							<Button
								variant="ghost"
								size="xs"
								:label="__('Delete Lesson')"
								class="-my-0.5 invisible group-hover:visible group-focus-within:visible [@media(hover:none)]:visible"
								@click="
									emit('delete-lesson', {
										lesson: lesson.name,
										chapter: chapter.name,
									})
								"
							>
								<template #icon>
									<span class="lucide-trash-2 h-4 w-4 text-ink-red-5" />
								</template>
							</Button>
						</div>
					</div>
				</template>
			</Draggable>
			<div
				v-if="isDraftInChapter"
				class="ps-8 py-2 pe-4 bg-surface-gray-3 rounded-5 text-sm leading-5 text-ink-gray-6"
				data-testid="outline-draft-lesson"
			>
				{{ __('New lesson') }}
			</div>
			<div v-if="allowEdit" class="flex mt-2 mb-4 ps-8">
				<Button @click="addLesson">
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
import { Button, TextInput, Tooltip, toast } from 'frappe-ui'
import { computed, inject, nextTick, ref, watch } from 'vue'
import Draggable from 'vuedraggable'
import { Disclosure, DisclosureButton, DisclosurePanel } from '@headlessui/vue'
import { useRoute } from 'vue-router'
import type { RouteLocationRaw } from 'vue-router'
import type { InputExposed } from 'frappe-ui'
import type { OutlineChapter, OutlineLesson, SessionUser } from '@/types'
import { draftLessonNumber } from '@/utils/courseOutline'

interface DraggableEvent {
	item: { __draggable_context: { element: OutlineChapter | OutlineLesson } }
	from: { dataset: { chapter: string } }
	to: { dataset: { chapter: string } }
	newIndex: number
}

const props = withDefaults(
	defineProps<{
		chapter: OutlineChapter
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
	'rename-chapter': [{ chapter: OutlineChapter; title: string }]
	'renaming-change': [boolean]
	'delete-chapter': [string]
	'delete-lesson': [{ lesson: string; chapter: string }]
	'move-lesson': [DraggableEvent]
	'create-lesson': [{ chapter: OutlineChapter; lessonIdx: number }]
}>()

const route = useRoute()
const user = inject<SessionUser>('$user')!

const isRenaming = ref<boolean>(false)
const renameValue = ref<string>('')
const renameInput = ref<InputExposed | null>(null)

// Tell the parent outline to lock chapter dragging while a name is being edited,
// so a stray drag can't fire mid-rename.
watch(isRenaming, (renaming) => emit('renaming-change', renaming))

function startRename(): void {
	renameValue.value = props.chapter.title
	isRenaming.value = true
	nextTick(() => {
		renameInput.value?.focus()
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
	// ?editLesson ("<chapter>-<lesson>"), which survives navigating away and
	// back, with selectedLessonNumber as a fallback. Default to the first
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

// A SCORM chapter has no DisclosurePanel, so it never reaches the per-lesson lock
// affordance below: without this it looks identical to an open one and the student
// only learns it is locked after SCORMChapter.vue bounces them back. Same rule as
// that page's own isLocked.
const isScormChapterLocked = computed<boolean>(() =>
	Boolean(
		props.chapter.is_scorm_package &&
			props.chapter.lessons?.length &&
			props.chapter.lessons.every((l) => l.locked)
	)
)

// The editor's open lesson is a draft in this chapter, not yet in its lessons.
const isDraftInChapter = computed<boolean>(
	() =>
		props.inlineSelect &&
		props.selectedLessonNumber === draftLessonNumber(props.chapter.idx)
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
			hash: '#editor',
			query: { editLesson: lesson.number },
		}
	}
	return {
		name: 'Lesson',
		params: { courseName: props.courseName, chapterNumber, lessonNumber },
	}
}

function onLessonClick(lesson: OutlineLesson) {
	if (lesson.locked) return
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

function notifyEnrollment(): void {
	toast.success(__('Please enroll for this course to view this lesson'))
}

// A SCORM chapter has no lessons to disclose, so its header is a link to the
// player instead of a disclosure button.
const headerComponent = computed(() => {
	if (!props.chapter.is_scorm_package) return DisclosureButton
	if (isScormChapterLocked.value) return 'div'
	return user.data ? 'router-link' : 'button'
})

const headerProps = computed(() => {
	if (!props.chapter.is_scorm_package || isScormChapterLocked.value) return {}
	if (!user.data) return { type: 'button', onClick: notifyEnrollment }
	return {
		to: {
			name: 'SCORMChapter',
			params: {
				courseName: props.courseName,
				chapterName: props.chapter.name,
			},
		},
	}
})
</script>
