<template>
	<div class="flex flex-col h-full">
		<div class="bg-surface-gray-1 px-5 py-5 border-b">
			<div class="text-lg font-semibold text-ink-gray-9 leading-snug">
				{{ courseTitle }}
			</div>
			<div class="mt-4 flex items-center gap-2 text-sm text-ink-gray-7">
				<Cloud class="size-4 stroke-1.5" />
				<span>{{ __('Completed') }} {{ displayedProgress }}%</span>
			</div>
			<div
				class="h-1 w-full rounded-full bg-surface-gray-2 overflow-hidden mt-2"
			>
				<div
					class="h-full bg-surface-green-3 transition-all"
					:style="{ width: `${displayedProgress}%` }"
				/>
			</div>
		</div>

		<div class="flex-1 overflow-y-auto px-2 py-3">
			<Disclosure
				v-for="chapter in outline.data || []"
				:key="chapter.name"
				v-slot="{ open }"
				:defaultOpen="chapterDefaultOpen(chapter)"
			>
				<DisclosureButton
					class="w-full flex items-center justify-between rounded px-3 py-2 hover:bg-surface-gray-2 text-left"
				>
					<div
						class="flex items-center gap-2 text-sm font-medium text-ink-gray-9 min-w-0"
					>
						<ChevronDown
							class="size-4 stroke-1.5 shrink-0 transition-transform"
							:class="{ '-rotate-90': !open }"
						/>
						<span class="truncate">{{ chapter.title }}</span>
					</div>
					<span
						v-if="chapter.lessons?.length"
						class="text-xs text-ink-gray-5 shrink-0"
					>
						{{ chapter.lessons.length }}
					</span>
				</DisclosureButton>
				<DisclosurePanel>
					<component
						:is="inlineSelect ? 'div' : 'router-link'"
						v-for="lesson in chapter.lessons || []"
						:key="lesson.name"
						:to="
							inlineSelect
								? undefined
								: {
										name: 'Lesson',
										params: {
											courseName,
											chapterNumber: lesson.number.split('-')[0],
											lessonNumber: lesson.number.split('-')[1],
										},
								  }
						"
						class="flex items-center gap-3 rounded ps-9 pe-3 py-2 text-sm text-ink-gray-8 hover:bg-surface-gray-2"
						:class="[
							inlineSelect ? 'cursor-pointer' : '',
							isActive(lesson.number)
								? 'bg-surface-gray-2 text-ink-gray-9'
								: '',
						]"
						@click="
							inlineSelect &&
								emit('select-lesson', {
									chapterNumber: lesson.number.split('-')[0],
									lessonNumber: lesson.number.split('-')[1],
								})
						"
					>
						<component
							:is="iconFor(lesson.icon)"
							class="size-4 stroke-1.5 shrink-0 text-ink-gray-7"
						/>
						<span class="truncate flex-1">{{ lesson.title }}</span>
						<CircleCheck
							v-if="lesson.is_complete"
							class="size-4 stroke-1.5 shrink-0 text-green-700 fill-none"
						/>
						<Circle v-else class="size-4 stroke-1.5 shrink-0 text-ink-gray-4" />
					</component>
				</DisclosurePanel>
			</Disclosure>
		</div>
	</div>
</template>

<script setup>
import { computed, watch, watchEffect } from 'vue'
import { createResource } from 'frappe-ui'
import { Disclosure, DisclosureButton, DisclosurePanel } from '@headlessui/vue'
import {
	ChevronDown,
	Circle,
	CircleCheck,
	Cloud,
	FileText,
	HelpCircle,
	LockKeyhole,
	MonitorPlay,
	NotebookPen,
	SquareCode,
} from 'lucide-vue-next'

const props = defineProps({
	courseName: { type: String, required: true },
	courseTitle: { type: String, default: '' },
	progress: { type: Number, default: 0 },
	selectedLessonNumber: { type: String, default: '' },
	completedLesson: { type: String, default: null },
	inlineSelect: { type: Boolean, default: false },
	withProgress: { type: Boolean, default: true },
})

const emit = defineEmits(['select-lesson'])

const outline = createResource({
	url: 'lms.lms.utils.get_course_outline',
	cache: [
		'course_outline_student',
		props.courseName,
		props.withProgress ? 'progress' : 'no-progress',
	],
	makeParams() {
		return {
			course: props.courseName,
			progress: props.withProgress,
		}
	},
	auto: true,
})

watch(
	() => props.courseName,
	() => outline.reload()
)

// Re-runs whenever either source updates so a completion event that
// lands before outline.data finishes loading still gets applied (and a
// late-arriving outline reload doesn't wipe an already-marked lesson).
watchEffect(() => {
	const lessonName = props.completedLesson
	if (!lessonName || !outline.data) return
	for (const chapter of outline.data) {
		const found = chapter.lessons?.find((l) => l.name === lessonName)
		if (found) {
			found.is_complete = true
			return
		}
	}
})

const displayedProgress = computed(() => Math.ceil(props.progress || 0))

function iconFor(icon) {
	switch (icon) {
		case 'icon-youtube':
			return MonitorPlay
		case 'icon-quiz':
			return HelpCircle
		case 'icon-assignment':
			return NotebookPen
		case 'icon-code':
			return SquareCode
		case 'icon-lock':
			return LockKeyhole
		default:
			return FileText
	}
}

function isActive(number) {
	return props.selectedLessonNumber === number
}

function chapterDefaultOpen(chapter) {
	if (!props.selectedLessonNumber) return chapter.idx === 1
	return (
		chapter.lessons?.some((l) => l.number === props.selectedLessonNumber) ||
		false
	)
}
</script>
