<template>
	<div class="">
		<div
			v-if="title && (outline.data?.length || allowEdit)"
			class="flex items-center justify-between space-x-2 mb-4 px-2"
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
				{{ __('Add Chapter') }}
			</Button>
		</div>
		<div
			:class="{
				'border-2 rounded-md py-2 px-2': showOutline && outline.data?.length,
			}"
		>
			<Disclosure
				v-slot="{ open }"
				v-for="(chapter, index) in outline.data"
				:key="chapter.name"
				:defaultOpen="openChapterDetail(chapter.idx)"
			>
				<DisclosureButton ref="" class="flex items-center w-full p-2 group">
					<ChevronRight
						:class="{
							'rotate-90 transform duration-200': open,
							'duration-200': !open,
							hidden: chapter.is_scorm_package,
							open: index == 1,
						}"
						class="h-4 w-4 text-ink-gray-9 stroke-1"
					/>
					<div
						class="text-base text-left text-ink-gray-9 font-medium leading-5 ml-2"
						@click="redirectToChapter(chapter)"
					>
						{{ chapter.title }}
					</div>
					<div class="flex ml-auto space-x-4">
						<Tooltip :text="__('Edit Chapter')" placement="bottom">
							<FilePenLine
								v-if="allowEdit"
								@click.prevent="openChapterModal(chapter)"
								class="h-4 w-4 text-ink-gray-9 invisible group-hover:visible"
							/>
						</Tooltip>
						<Tooltip :text="__('Delete Chapter')" placement="bottom">
							<Trash2
								v-if="allowEdit"
								@click.prevent="trashChapter(chapter.name)"
								class="h-4 w-4 text-ink-red-3 invisible group-hover:visible"
							/>
						</Tooltip>
					</div>
				</DisclosureButton>
				<DisclosurePanel v-if="!chapter.is_scorm_package">
					<Draggable
						v-if="!chapter.is_scorm_package"
						:list="chapter.lessons"
						:disabled="!allowEdit"
						item-key="name"
						group="items"
						@end="updateOutline"
						:data-chapter="chapter.name"
					>
						<template #item="{ element: lesson }">
							<div
								class="outline-lesson pl-8 py-2 pr-4 text-ink-gray-9"
								:class="
									isActiveLesson(lesson.number) ? 'bg-surface-gray-3' : ''
								"
							>
								<router-link
									:to="{
										name: allowEdit ? 'LessonForm' : 'Lesson',
										params: {
											courseName: courseName,
											chapterNumber: lesson.number.split('.')[0],
											lessonNumber: lesson.number.split('.')[1],
										},
									}"
								>
									<div class="flex items-center text-sm leading-5 group">
										<MonitorPlay
											v-if="lesson.icon === 'icon-youtube'"
											class="h-4 w-4 stroke-1 mr-2"
										/>
										<HelpCircle
											v-else-if="lesson.icon === 'icon-quiz'"
											class="h-4 w-4 stroke-1 mr-2"
										/>
										<FileText
											v-else-if="lesson.icon === 'icon-list'"
											class="h-4 w-4 text-ink-gray-9 stroke-1 mr-2"
										/>
										{{ lesson.title }}
										<Trash2
											v-if="allowEdit"
											@click.prevent="trashLesson(lesson.name, chapter.name)"
											class="h-4 w-4 text-ink-red-3 ml-auto invisible group-hover:visible"
										/>
										<Check
											v-if="lesson.is_complete"
											class="h-4 w-4 text-green-700 ml-2"
										/>
									</div>
								</router-link>
							</div>
						</template>
					</Draggable>
					<div v-if="allowEdit" class="flex mt-2 mb-4 pl-8">
						<router-link
							v-if="!chapter.is_scorm_package"
							:to="{
								name: 'LessonForm',
								params: {
									courseName: courseName,
									chapterNumber: chapter.idx,
									lessonNumber: chapter.lessons.length + 1,
								},
							}"
						>
							<Button>
								{{ __('Add Lesson') }}
							</Button>
						</router-link>
					</div>
				</DisclosurePanel>
			</Disclosure>
		</div>
	</div>
	<ChapterModal
		v-if="user.data"
		v-model="showChapterModal"
		v-model:outline="outline"
		:course="courseName"
		:chapterDetail="getCurrentChapter()"
	/>
</template>
<script setup>
import { Button, createResource, Tooltip, toast } from 'frappe-ui'
import { getCurrentInstance, inject, ref } from 'vue'
import Draggable from 'vuedraggable'
import { Disclosure, DisclosureButton, DisclosurePanel } from '@headlessui/vue'
import {
	Check,
	ChevronRight,
	FileText,
	FilePenLine,
	HelpCircle,
	MonitorPlay,
	Trash2,
} from 'lucide-vue-next'
import { useRoute, useRouter } from 'vue-router'
import ChapterModal from '@/components/Modals/ChapterModal.vue'

const route = useRoute()
const router = useRouter()
const user = inject('$user')
const showChapterModal = ref(false)
const currentChapter = ref(null)
const app = getCurrentInstance()
const { $dialog } = app.appContext.config.globalProperties

const props = defineProps({
	courseName: {
		type: String,
		required: true,
	},
	showOutline: {
		type: Boolean,
		default: false,
	},
	title: {
		type: String,
		default: '',
	},
	allowEdit: {
		type: Boolean,
		default: false,
	},
	getProgress: {
		type: Boolean,
		default: false,
	},
})

const outline = createResource({
	url: 'lms.lms.utils.get_course_outline',
	cache: ['course_outline', props.courseName],
	params: {
		course: props.courseName,
		progress: props.getProgress,
	},
	auto: true,
})

const deleteLesson = createResource({
	url: 'lms.lms.api.delete_lesson',
	makeParams(values) {
		return {
			lesson: values.lesson,
			chapter: values.chapter,
		}
	},
	onSuccess() {
		outline.reload()
		toast.success(__('Lesson deleted successfully'))
	},
})

const updateLessonIndex = createResource({
	url: 'lms.lms.api.update_lesson_index',
	makeParams(values) {
		return {
			lesson: values.lesson,
			sourceChapter: values.sourceChapter,
			targetChapter: values.targetChapter,
			idx: values.idx,
		}
	},
	onSuccess() {
		toast.success(__('Lesson moved successfully'))
	},
})

const trashLesson = (lessonName, chapterName) => {
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
					deleteLesson.submit({
						lesson: lessonName,
						chapter: chapterName,
					})
					close()
				},
			},
		],
	})
}

const openChapterDetail = (index) => {
	return index == route.params.chapterNumber || index == 1
}

const openChapterModal = (chapter = null) => {
	currentChapter.value = chapter
	showChapterModal.value = true
}

const getCurrentChapter = () => {
	return currentChapter.value
}

const updateOutline = (e) => {
	updateLessonIndex.submit({
		lesson: e.item.__draggable_context.element.name,
		sourceChapter: e.from.dataset.chapter,
		targetChapter: e.to.dataset.chapter,
		idx: e.newIndex,
	})
}

const deleteChapter = createResource({
	url: 'lms.lms.api.delete_chapter',
	makeParams(values) {
		return {
			chapter: values.chapter,
		}
	},
	onSuccess() {
		outline.reload()
		toast.success(__('Chapter deleted successfully'))
	},
})

const trashChapter = (chapterName) => {
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

const redirectToChapter = (chapter) => {
	if (!chapter.is_scorm_package) return
	event.preventDefault()
	if (props.allowEdit) return
	if (!user.data) {
		toast.success(__('Please enroll for this course to view this lesson'))
		return
	}

	router.push({
		name: 'SCORMChapter',
		params: {
			courseName: props.courseName,
			chapterName: chapter.name,
		},
	})
}

const isActiveLesson = (lessonNumber) => {
	return (
		route.params.chapterNumber == lessonNumber.split('.')[0] &&
		route.params.lessonNumber == lessonNumber.split('.')[1]
	)
}
</script>
