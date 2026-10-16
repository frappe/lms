<template>
	<component
		:is="framed ? AssessmentCard : 'div'"
		class="flex h-full flex-col overflow-hidden"
	>
		<AssessmentCardHeader
			icon="lucide-code-xml"
			:title="__('Programming Exercise')"
			:subtitle="title"
		>
			<Badge
				v-if="submissionStatus"
				class="whitespace-nowrap"
				:theme="submissionStatus == 'Passed' ? 'green' : 'red'"
				size="sm"
			>
				{{ __(submissionStatus) }}
			</Badge>
			<Button
				variant="ghost"
				size="sm"
				data-testid="reset-code"
				:disabled="running"
				@click="emit('reset')"
			>
				{{ __('Reset') }}
			</Button>
			<Tooltip>
				<Button
					variant="solid"
					size="sm"
					data-testid="run-code"
					:loading="running"
					:disabled="running || !canRun"
					@click="emit('run')"
				>
					{{ running ? __('Running') : __('Run code') }}
				</Button>
				<template #content>
					<span class="flex items-center gap-x-1.5">
						{{ __('Run code') }}
						<KeyboardShortcut combo="Mod+Enter" />
					</span>
				</template>
			</Tooltip>
		</AssessmentCardHeader>

		<div
			class="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]"
		>
			<div
				class="flex min-h-0 flex-col border-b border-outline-gray-1 md:border-b-0 md:border-e"
			>
				<div
					class="flex h-11 shrink-0 items-center border-b border-outline-gray-1 bg-surface-gray-1 px-3.5"
				>
					<h3 class="text-sm-semibold text-ink-gray-9">{{ __('Problem') }}</h3>
				</div>
				<div
					data-testid="problem-pane"
					class="min-h-0 flex-1 overflow-y-auto p-3.5"
				>
					<div
						v-safe-html:rich="problemStatement"
						class="ProseMirror prose prose-sm max-w-none !whitespace-normal prose-pre:bg-surface-gray-3 prose-pre:text-ink-gray-9"
					></div>
				</div>
			</div>

			<div class="flex min-h-0 flex-col">
				<div
					class="flex h-11 shrink-0 items-center justify-between gap-x-2 border-b border-outline-gray-1 bg-surface-gray-1 px-3"
				>
					<div class="flex min-w-0 items-center gap-x-1.5">
						<span class="lucide-file size-3.5 shrink-0 text-ink-gray-5" />
						<span class="truncate font-mono text-xs text-ink-gray-7">
							{{ language }}
						</span>
					</div>
					<span v-if="saved" class="shrink-0 text-xs text-ink-gray-6">
						{{ __('autosaved') }}
					</span>
				</div>
				<div class="exercise-editor min-h-0 flex-1 overflow-y-auto">
					<slot name="editor" />
				</div>
				<ExerciseConsole
					:lines="consoleLines"
					:duration="duration"
					:running="running"
				/>
				<ExerciseTestCases
					data-testid="tests-pane"
					class="max-h-80 shrink-0 overflow-y-auto border-t border-outline-gray-1"
					:results="results"
				/>
			</div>
		</div>
	</component>
</template>

<script setup lang="ts">
import { Badge, Button, KeyboardShortcut, Tooltip } from 'frappe-ui'
import AssessmentCard from '@/components/Assessment/AssessmentCard.vue'
import AssessmentCardHeader from '@/components/Assessment/AssessmentCardHeader.vue'
import ExerciseTestCases, {
	type TestCaseResult,
} from '@/components/ProgrammingExercises/ExerciseTestCases.vue'
import ExerciseConsole, {
	type ConsoleLine,
} from '@/components/ProgrammingExercises/ExerciseConsole.vue'

withDefaults(
	defineProps<{
		title: string
		language: string
		problemStatement: string
		results: TestCaseResult[]
		consoleLines: ConsoleLine[]
		duration: number | null
		running: boolean
		canRun: boolean
		saved: boolean
		submissionStatus?: string
		// Boxed where it sits among other content, as in a lesson. On a page of
		// its own it fills the page instead: a box there only adds a frame.
		framed?: boolean
	}>(),
	{ submissionStatus: undefined, framed: true }
)

const emit = defineEmits<{
	run: []
	reset: []
}>()
</script>
