<template>
	<div class="border rounded-lg overflow-hidden">
		<Disclosure
			v-slot="{ open }"
			v-for="(chapter, chapterIndex) in outline.data"
			:key="chapter.name"
			:defaultOpen="chapterIndex === 0"
			as="div"
			class="border-b last:border-b-0"
		>
			<DisclosureButton
				class="flex items-center justify-between w-full p-4 hover:bg-gray-50 transition-colors"
			>
				<div class="flex items-center">
					<ChevronUp
						:class="[
							'h-4 w-4 text-ink-gray-5 mr-2 transition-transform duration-200',
							open ? '' : 'rotate-180',
						]"
					/>
					<span class="font-medium text-teal-600">{{ chapter.title }}</span>
				</div>
				<div class="flex items-center text-sm text-ink-gray-5">
					<FileText class="h-4 w-4 mr-1.5" />
					<span>{{ chapter.lessons?.length || 0 }} {{ __('Materials') }}</span>
				</div>
			</DisclosureButton>

			<DisclosurePanel class="bg-gray-50/50">
				<div
					v-for="(lesson, lessonIndex) in chapter.lessons"
					:key="lesson.name"
					class="flex items-center px-4 py-3 pl-10 border-t border-gray-100 hover:bg-gray-100/50 transition-colors"
				>
					<router-link
						:to="{
							name: 'Lesson',
							params: {
								courseName: courseName,
								chapterNumber: lesson.number.split('.')[0],
								lessonNumber: lesson.number.split('.')[1],
							},
						}"
						class="flex items-center flex-1 text-sm text-ink-gray-7"
					>
						<component
							:is="getLessonIcon(lesson.icon)"
							class="h-4 w-4 mr-3 text-ink-gray-5 flex-shrink-0"
						/>
						<span class="flex-1">{{ lesson.title }}</span>
						<Check
							v-if="lesson.is_complete"
							class="h-4 w-4 text-teal-500 ml-2 flex-shrink-0"
						/>
					</router-link>
				</div>
			</DisclosurePanel>
		</Disclosure>
	</div>
</template>

<script setup>
import { createResource } from 'frappe-ui'
import { Disclosure, DisclosureButton, DisclosurePanel } from '@headlessui/vue'
import {
	Check,
	ChevronUp,
	FileText,
	MonitorPlay,
	HelpCircle,
	BookOpen,
} from 'lucide-vue-next'
import { watch, markRaw } from 'vue'

const props = defineProps({
	courseName: {
		type: String,
		required: true,
	},
	getProgress: {
		type: Boolean,
		default: false,
	},
})

const outline = createResource({
	url: 'lms.lms.utils.get_course_outline',
	cache: ['course_outline_v2', props.courseName, props.getProgress],
	makeParams() {
		return {
			course: props.courseName,
			progress: props.getProgress,
		}
	},
	auto: true,
})

watch(
	() => props.courseName,
	() => {
		outline.reload()
	},
)

const getLessonIcon = (iconType) => {
	switch (iconType) {
		case 'icon-youtube':
			return markRaw(MonitorPlay)
		case 'icon-quiz':
			return markRaw(HelpCircle)
		case 'icon-list':
		default:
			return markRaw(FileText)
	}
}
</script>
