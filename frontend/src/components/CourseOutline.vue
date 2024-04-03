<template>
	<div class="text-base">
		<div
			v-if="title && (outline.data?.length || allowEdit)"
			class="flex items-center justify-between mb-4"
		>
			<div class="font-semibold" :class="allowEdit ? 'text-base' : 'text-lg'">
				{{ __(title) }}
			</div>
			<Button size="sm" v-if="allowEdit" @click="openChapterModal()">
				{{ __('Add Chapter') }}
			</Button>
			<!-- <span class="font-medium cursor-pointer" @click="expandAllChapters()">
				{{ expandAll ? __("Collapse all chapters") : __("Expand all chapters") }}
			</span> -->
		</div>
		<div
			:class="{
				'shadow rounded-md pt-2 px-2': showOutline && outline.data?.length,
			}"
		>
			<Disclosure
				v-slot="{ open }"
				v-for="(chapter, index) in outline.data"
				:key="chapter.name"
				:defaultOpen="openChapterDetail(chapter.idx)"
			>
				<DisclosureButton ref="" class="flex w-full px-2 py-3">
					<ChevronRight
						:class="{
							'rotate-90 transform duration-200': open,
							'duration-200': !open,
							open: index == 1,
						}"
						class="h-4 w-4 text-gray-900 stroke-1 mr-2"
					/>
					<div class="text-base text-left font-medium leading-5">
						{{ chapter.title }}
					</div>
				</DisclosureButton>
				<DisclosurePanel class="pb-2">
					<div v-for="lesson in chapter.lessons" :key="lesson.name">
						<div class="outline-lesson pl-8 py-2">
							<router-link
								:to="{
									name: allowEdit ? 'CreateLesson' : 'Lesson',
									params: {
										courseName: courseName,
										chapterNumber: lesson.number.split('.')[0],
										lessonNumber: lesson.number.split('.')[1],
									},
								}"
							>
								<div class="flex items-center text-sm leading-5">
									<MonitorPlay
										v-if="lesson.icon === 'icon-youtube'"
										class="h-4 w-4 text-gray-900 stroke-1 mr-2"
									/>
									<HelpCircle
										v-else-if="lesson.icon === 'icon-quiz'"
										class="h-4 w-4 text-gray-900 stroke-1 mr-2"
									/>
									<FileText
										v-else-if="lesson.icon === 'icon-list'"
										class="h-4 w-4 text-gray-900 stroke-1 mr-2"
									/>
									{{ lesson.title }}
									<Check
										v-if="lesson.is_complete"
										class="h-4 w-4 text-green-500 stroke-1.5 ml-2"
									/>
								</div>
							</router-link>
						</div>
					</div>
					<div v-if="allowEdit" class="flex mt-2 pl-8">
						<router-link
							:to="{
								name: 'CreateLesson',
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
						<Button class="ml-2" @click="openChapterModal(chapter)">
							{{ __('Edit Chapter') }}
						</Button>
					</div>
				</DisclosurePanel>
			</Disclosure>
		</div>
	</div>
	<ChapterModal
		v-model="showChapterModal"
		v-model:outline="outline"
		:course="courseName"
		:chapterDetail="getCurrentChapter()"
	/>
</template>
<script setup>
import { Button, createResource } from 'frappe-ui'
import { ref } from 'vue'
import { Disclosure, DisclosureButton, DisclosurePanel } from '@headlessui/vue'
import {
	ChevronRight,
	MonitorPlay,
	HelpCircle,
	FileText,
	Check,
} from 'lucide-vue-next'
import { useRoute } from 'vue-router'
import ChapterModal from '@/components/Modals/ChapterModal.vue'

const route = useRoute()
const expandAll = ref(true)
const showChapterModal = ref(false)
const currentChapter = ref(null)

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
})

const outline = createResource({
	url: 'lms.lms.utils.get_course_outline',
	cache: ['course_outline', props.courseName],
	params: {
		course: props.courseName,
	},
	auto: true,
})

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
</script>
<style>
.outline-lesson:has(.router-link-active) {
	background-color: theme('colors.gray.100');
}
</style>
