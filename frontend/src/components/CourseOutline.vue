<template>
	<div class="text-base">
		<div v-if="showHeader" class="flex justify-between mb-4">
			<div class="text-2xl font-semibold">
				{{ __('Course Content') }}
			</div>
			<!-- <span class="font-medium cursor-pointer" @click="expandAllChapters()">
				{{ expandAll ? __("Collapse all chapters") : __("Expand all chapters") }}
			</span> -->
		</div>
		<div :class="{ 'shadow rounded-md pt-2 px-2': showOutline }">
			<Disclosure
				v-slot="{ open }"
				v-for="(chapter, index) in outline.data"
				:key="chapter.name"
				:defaultOpen="openChapter(chapter.idx)"
			>
				<DisclosureButton ref="" class="flex w-full px-2 py-4">
					<ChevronRight
						:class="{
							'rotate-90 transform duration-200': open,
							'duration-200': !open,
							open: index == 1,
						}"
						class="h-4 w-4 text-gray-900 stroke-1 mr-2"
					/>
					<div class="text-base text-left font-medium">
						{{ chapter.title }}
					</div>
					<div class="ml-auto text-sm">
						{{ chapter.lessons.length }}
						{{ chapter.lessons.length == 1 ? __('lesson') : __('lessons') }}
					</div>
				</DisclosureButton>
				<DisclosurePanel class="pb-2">
					<div v-for="lesson in chapter.lessons" :key="lesson.name">
						<div class="outline-lesson py-2 pl-8">
							<router-link
								:to="{
									name: 'Lesson',
									params: {
										courseName: courseName,
										chapterNumber: lesson.number.split('.')[0],
										lessonNumber: lesson.number.split('.')[1],
									},
								}"
							>
								<div class="flex items-center text-sm">
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
								</div>
							</router-link>
						</div>
					</div>
				</DisclosurePanel>
			</Disclosure>
		</div>
	</div>
</template>
<script setup>
import { createResource } from 'frappe-ui'
import { ref } from 'vue'
import { Disclosure, DisclosureButton, DisclosurePanel } from '@headlessui/vue'
import {
	ChevronRight,
	MonitorPlay,
	HelpCircle,
	FileText,
} from 'lucide-vue-next'
import { useRoute } from 'vue-router'

const route = useRoute()
const expandAll = ref(true)
const props = defineProps({
	courseName: {
		type: String,
		required: true,
	},
	showOutline: {
		type: Boolean,
		default: false,
	},
	showHeader: {
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

const openChapter = (index) => {
	return index == route.params.chapterNumber || index == 1
}

const expandAllChapters = () => {
	expandAll.value = !expandAll.value
}
</script>
<style>
.outline-lesson:has(.router-link-active) {
	background-color: theme('colors.gray.100');
}
</style>
