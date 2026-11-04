<template>
	<div class="flex h-full items-center justify-center px-6">
		<!-- Nudged up: the geometric centre of a tall column reads as too low. -->
		<div
			class="flex w-full max-w-md flex-col items-center gap-5 pb-16 text-center"
		>
			<div
				class="flex size-12 items-center justify-center rounded-full bg-surface-gray-2"
			>
				<span
					class="size-6 text-ink-gray-7"
					:class="state.icon"
					aria-hidden="true"
				/>
			</div>
			<div class="flex flex-col gap-1.5">
				<h2 class="text-lg-semibold text-ink-gray-9">{{ state.title }}</h2>
				<p class="text-p-base text-ink-gray-6">{{ state.description }}</p>
			</div>
			<div class="flex flex-wrap items-center justify-center gap-2">
				<Button variant="solid" :label="state.action" @click="state.onAction">
					<template #prefix>
						<span class="lucide-plus size-4" />
					</template>
				</Button>
				<!-- An href makes the Button an anchor that opens in a new tab. -->
				<Button
					variant="subtle"
					:href="state.docs"
					:label="__('Read the docs')"
					@click="openDocs"
				>
					<template #prefix>
						<span class="lucide-book-open size-4" />
					</template>
				</Button>
			</div>
			<ol
				v-if="state.steps"
				class="mt-2 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm"
				:aria-label="__('Steps to publish')"
			>
				<li
					v-for="(step, index) in state.steps"
					:key="step.label"
					class="flex items-center gap-2"
					:aria-current="step.current ? 'step' : undefined"
				>
					<span
						v-if="step.done"
						class="lucide-circle-check size-5 text-ink-gray-7"
						aria-hidden="true"
					/>
					<span
						v-else
						class="grid size-5 place-items-center rounded-full border pt-px text-xs leading-none"
						:class="
							step.current
								? 'border-outline-gray-4 font-medium text-ink-gray-9'
								: 'border-outline-gray-2 text-ink-gray-6'
						"
					>
						{{ index + 1 }}
					</span>
					<span
						:class="
							step.current ? 'font-medium text-ink-gray-9' : 'text-ink-gray-6'
						"
					>
						{{ step.label }}
					</span>
				</li>
			</ol>
		</div>
	</div>
</template>

<script setup lang="ts">
import { Button } from 'frappe-ui'
import { computed, watch } from 'vue'
import { useTelemetry } from '@framework/ui/telemetry/index'
import type { OutlineChapter } from '@/types'

type Step = { label: string; done: boolean; current: boolean }
type StateName = 'no_chapters' | 'no_lessons' | 'no_lesson_open'

const props = defineProps<{
	courseName: string
	chapters: OutlineChapter[]
	isMobile?: boolean
}>()

const SOURCE = 'course_editor_empty_state'

const emit = defineEmits<{
	'create-chapter': [source: typeof SOURCE]
	'add-lesson': [{ chapter: OutlineChapter; source: typeof SOURCE }]
}>()

const { capture } = useTelemetry()

const lessonCount = computed(() =>
	props.chapters.reduce(
		(count, chapter) => count + (chapter.lessons?.length ?? 0),
		0
	)
)

// The steps mirror the publish checklist: a chapter, a lesson, then publish.
// They show while the course is still empty, as orientation; a course with
// lessons already knows the drill.
function steps(current: 'chapter' | 'lesson'): Step[] {
	const order = ['chapter', 'lesson', 'publish'] as const
	const labels = {
		chapter: __('Create a chapter'),
		lesson: __('Add a lesson'),
		publish: __('Publish'),
	}
	const position = order.indexOf(current)
	return order.map((name, index) => ({
		label: labels[name],
		done: index < position,
		current: index === position,
	}))
}

const DOCS = {
	chapter: 'https://docs.frappe.io/learning/add-a-chapter',
	lesson: 'https://docs.frappe.io/learning/course-creation/adding-a-lesson',
}

const state = computed(() => {
	if (!props.chapters.length) {
		return {
			name: 'no_chapters' as StateName,
			icon: 'lucide-layers',
			title: __('Start building your course'),
			description: __(
				'A course is chapters with lessons inside. Create the first chapter, then add lessons to it.'
			),
			action: __('Create chapter'),
			onAction: () =>
				act('create_chapter', () => emit('create-chapter', SOURCE)),
			steps: steps('chapter'),
			docs: DOCS.chapter,
		}
	}
	const first = props.chapters[0]
	if (!lessonCount.value) {
		return {
			name: 'no_lessons' as StateName,
			icon: 'lucide-file-plus',
			title: __('Add your first lesson'),
			description: __(
				'Lessons hold your videos, text, quizzes and files. Add one to {0} to get going.'
			).format(`“${first.title}”`),
			action: __('Add a lesson'),
			onAction: () =>
				act('add_lesson', () =>
					emit('add-lesson', { chapter: first, source: SOURCE })
				),
			steps: steps('lesson'),
			docs: DOCS.lesson,
		}
	}
	// New lessons usually belong at the end, so the last chapter takes them.
	const last = props.chapters[props.chapters.length - 1]
	return {
		name: 'no_lesson_open' as StateName,
		icon: 'lucide-book-open',
		title: __('Pick a lesson to edit'),
		description: props.isMobile
			? __('Open the chapters below to choose a lesson, or add a new one.')
			: __('Choose a lesson from the chapters panel, or add a new one.'),
		action: __('Add a lesson'),
		onAction: () =>
			act('add_lesson', () =>
				emit('add-lesson', { chapter: last, source: SOURCE })
			),
		steps: null,
		docs: DOCS.lesson,
	}
})

// One event per state the author lands in, so a course that goes from no
// chapters to no lessons reports both.
watch(
	() => state.value.name,
	(name) =>
		capture('course_editor_empty_state_shown', {
			course: props.courseName,
			state: name,
		}),
	{ immediate: true }
)

function act(action: 'create_chapter' | 'add_lesson', run: () => void) {
	capture('course_editor_empty_state_action', {
		course: props.courseName,
		state: state.value.name,
		action,
	})
	run()
}

function openDocs() {
	capture('course_editor_empty_state_docs_opened', {
		course: props.courseName,
		state: state.value.name,
	})
}
</script>
