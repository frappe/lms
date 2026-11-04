<template>
	<AssessmentCard class="flex h-full flex-col">
		<AssessmentCardHeader
			icon="lucide-code-xml"
			:title="__('Programming Exercise')"
			:subtitle="title"
		>
			<Button
				variant="ghost"
				size="sm"
				data-testid="reset-code"
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
			<Tabs
				v-model="activeTab"
				class="min-h-0 border-b border-outline-gray-1 md:border-b-0 md:border-e"
			>
				<TabList class="h-11 bg-surface-gray-1 px-3.5 py-0">
					<TabTrigger value="problem" :label="__('Problem')" />
					<TabTrigger value="tests" :label="__('Test cases')" />
				</TabList>
				<TabPanel value="problem">
					<div data-testid="problem-pane" class="min-h-0 overflow-y-auto p-3.5">
						<div
							v-safe-html:rich="problemStatement"
							class="ProseMirror prose prose-sm max-w-none !whitespace-normal prose-pre:bg-surface-gray-3 prose-pre:text-ink-gray-9"
						></div>
					</div>
				</TabPanel>
				<TabPanel value="tests">
					<ExerciseTestCases
						data-testid="tests-pane"
						role="status"
						aria-live="polite"
						class="min-h-0 overflow-y-auto"
						:results="results"
						:duration="duration"
					/>
				</TabPanel>
			</Tabs>

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
					<span class="shrink-0 text-xs text-ink-gray-5">{{ status }}</span>
				</div>
				<div class="exercise-editor min-h-0 flex-1 overflow-y-auto">
					<slot name="editor" />
				</div>
				<ExerciseConsole
					:lines="consoleLines"
					:duration="duration"
					:running="running"
				/>
			</div>
		</div>
	</AssessmentCard>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import {
	Button,
	KeyboardShortcut,
	TabList,
	TabPanel,
	Tabs,
	TabTrigger,
	Tooltip,
} from 'frappe-ui'
import AssessmentCard from '@/components/Assessment/AssessmentCard.vue'
import AssessmentCardHeader from '@/components/Assessment/AssessmentCardHeader.vue'
import ExerciseTestCases, {
	type TestCaseResult,
} from '@/components/ProgrammingExercises/ExerciseTestCases.vue'
import ExerciseConsole, {
	type ConsoleLine,
} from '@/components/ProgrammingExercises/ExerciseConsole.vue'

type WorkspaceTab = 'problem' | 'tests'

const props = defineProps<{
	title: string
	language: string
	problemStatement: string
	results: TestCaseResult[]
	consoleLines: ConsoleLine[]
	duration: number | null
	running: boolean
	canRun: boolean
	saved: boolean
}>()

const emit = defineEmits<{
	run: []
	reset: []
}>()

const activeTab = ref<WorkspaceTab>('problem')

const passed = computed(
	() => props.results.filter((r) => r.status === 'Passed').length
)

const status = computed(() => {
	const parts: string[] = []
	if (props.results.length) {
		parts.push(
			__('{0} of {1} passed').format(passed.value, props.results.length)
		)
	}
	if (props.saved) parts.push(__('autosaved'))
	return parts.join(' · ')
})

const showTab = (tab: WorkspaceTab) => {
	activeTab.value = tab
}

defineExpose({ showTab })
</script>
