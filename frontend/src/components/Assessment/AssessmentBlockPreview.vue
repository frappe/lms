<template>
	<AssessmentCard
		v-if="loading"
		aria-busy="true"
		data-testid="block-preview-skeleton"
	>
		<AssessmentCardHeader :icon="icon" :title="label" preview />
		<div class="space-y-4 p-3.5">
			<Skeleton class="h-5 w-1/3 rounded-4" />
			<div v-if="kind == 'quiz'" class="grid grid-cols-2 gap-2 sm:grid-cols-4">
				<Skeleton v-for="i in 4" :key="i" class="h-14 rounded-6" />
			</div>
			<template v-else>
				<Skeleton class="h-4 w-full rounded-4" />
				<Skeleton class="h-4 w-4/5 rounded-4" />
			</template>
		</div>
	</AssessmentCard>

	<AssessmentCard v-else-if="!details" data-testid="block-preview-missing">
		<AssessmentCardHeader :icon="icon" :title="label" preview />
		<p class="p-3.5 text-p-base text-ink-gray-6">
			{{ __('{0} {1} could not be loaded.').format(label, name) }}
		</p>
	</AssessmentCard>

	<AssessmentCard v-else-if="details.kind == 'quiz'">
		<AssessmentCardHeader
			:icon="icon"
			:title="label"
			:subtitle="quizSummary.subtitle"
			preview
		>
			<Badge v-if="details.doc.enable_proctoring" theme="amber" size="sm">
				{{ __('Proctored') }}
			</Badge>
			<span
				v-if="details.doc.max_attempts"
				class="hidden text-xs text-ink-gray-6 sm:inline"
			>
				{{ attemptsAllowedLabel(details.doc.max_attempts) }}
			</span>
		</AssessmentCardHeader>
		<div class="space-y-3.5 p-3.5">
			<div class="text-base-semibold text-ink-gray-9">
				{{ details.doc.title }}
			</div>
			<QuizStats
				:questions="quizSummary.questions"
				:duration="quizSummary.duration"
				:passingPercentage="details.doc.passing_percentage"
				:maxAttempts="details.doc.max_attempts || null"
			/>
			<div class="flex justify-end">
				<Button variant="solid" disabled>{{ __('Start Quiz') }}</Button>
			</div>
		</div>
	</AssessmentCard>

	<AssessmentCard v-else-if="details.kind == 'assignment'">
		<AssessmentCardHeader
			:icon="icon"
			:title="label"
			:subtitle="details.doc.title"
			preview
		/>
		<div class="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
			<div
				class="min-w-0 space-y-2 border-b border-outline-gray-1 p-3.5 md:border-b-0 md:border-e"
			>
				<div class="text-sm text-ink-gray-6">{{ __('Brief') }}</div>
				<div
					v-safe-html:rich="details.doc.question"
					class="ProseMirror prose prose-table:table-fixed prose-td:p-2 prose-th:p-2 prose-td:border prose-th:border prose-td:border-outline-gray-2 prose-th:border-outline-gray-2 prose-td:relative prose-th:relative prose-th:bg-surface-gray-2 prose-sm max-w-none !whitespace-normal"
				></div>
			</div>
			<div class="flex min-w-0 flex-col">
				<div
					class="flex h-11 shrink-0 items-center border-b border-outline-gray-1 bg-surface-gray-1 px-3.5"
				>
					<span class="text-sm text-ink-gray-7">{{ __('Submission') }}</span>
				</div>
				<div class="p-3.5">
					<AssignmentUploadPrompt
						v-if="uploadTypes.includes(details.doc.type)"
						:type="details.doc.type"
					>
						<Button variant="outline" size="sm" disabled>
							{{ __('Upload File') }}
						</Button>
					</AssignmentUploadPrompt>
					<FormControl
						v-else-if="details.doc.type == 'URL'"
						type="text"
						placeholder="https://"
						:label="__('Enter a URL')"
						disabled
					/>
					<FormControl
						v-else
						type="textarea"
						:rows="5"
						:label="__('Write your answer here')"
						disabled
					/>
				</div>
			</div>
		</div>
	</AssessmentCard>

	<AssessmentCard v-else>
		<AssessmentCardHeader
			:icon="icon"
			:title="label"
			:subtitle="details.doc.title"
			preview
		>
			<Button variant="solid" size="sm" disabled>{{ __('Run code') }}</Button>
		</AssessmentCardHeader>
		<div
			class="grid grid-cols-1 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]"
		>
			<div
				class="min-w-0 space-y-2 border-b border-outline-gray-1 p-3.5 md:border-b-0 md:border-e"
			>
				<div class="text-sm text-ink-gray-6">{{ __('Problem') }}</div>
				<div
					v-safe-html:rich="details.doc.problem_statement"
					class="ProseMirror prose prose-sm max-w-none !whitespace-normal prose-pre:bg-surface-gray-3 prose-pre:text-ink-gray-9"
				></div>
			</div>
			<div class="flex min-w-0 flex-col">
				<div
					class="flex h-11 shrink-0 items-center gap-x-1.5 border-b border-outline-gray-1 bg-surface-gray-1 px-3"
				>
					<span class="lucide-file size-3.5 shrink-0 text-ink-gray-5" />
					<span
						data-testid="block-preview-language"
						class="truncate font-mono text-xs text-ink-gray-7"
					>
						{{ details.doc.language }}
					</span>
				</div>
				<div class="min-h-[8rem] flex-1 bg-surface-gray-1" />
			</div>
		</div>
	</AssessmentCard>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Badge, Button, call, FormControl, Skeleton } from 'frappe-ui'
import AssessmentCard from '@/components/Assessment/AssessmentCard.vue'
import AssessmentCardHeader from '@/components/Assessment/AssessmentCardHeader.vue'
import AssignmentUploadPrompt from '@/components/Assessment/AssignmentUploadPrompt.vue'
import QuizStats from '@/components/Assessment/QuizStats.vue'
import { attemptsAllowedLabel, formatQuizSubtitle } from '@/utils/quizSummary'
import type { QuizDetails } from '@/types/quiz'

export type PreviewKind = 'quiz' | 'assignment' | 'exercise'

type AssignmentSummary = { title: string; question: string; type: string }
type ExerciseSummary = {
	title: string
	problem_statement: string
	language: string
}

type Details =
	| { kind: 'quiz'; doc: QuizDetails }
	| { kind: 'assignment'; doc: AssignmentSummary }
	| { kind: 'exercise'; doc: ExerciseSummary }

const props = defineProps<{ kind: PreviewKind; name: string }>()

const uploadTypes = ['PDF', 'Image', 'Document']

const icon = {
	quiz: 'lucide-circle-help',
	assignment: 'lucide-notebook-pen',
	exercise: 'lucide-code-xml',
}[props.kind]

const label = {
	quiz: __('Quiz'),
	assignment: __('Assignment'),
	exercise: __('Programming Exercise'),
}[props.kind]

const loading = ref(true)
const details = ref<Details | null>(null)

// The quiz's own table rows carry each question's type, so the count and the
// subtitle need no question fetch. The quiz serves only a shuffled subset when
// limit_questions_to is set.
const quizSummary = computed(() => {
	if (details.value?.kind != 'quiz') {
		return { subtitle: '', questions: 0, duration: 0 }
	}
	const doc = details.value.doc
	let rows = (doc.questions ?? []).filter((row) => row.question)
	if (doc.shuffle_questions && doc.limit_questions_to) {
		rows = rows.slice(0, doc.limit_questions_to)
	}
	return {
		subtitle: formatQuizSubtitle(
			rows.map((row) => row.type),
			doc.passing_percentage
		),
		questions: rows.length,
		duration: parseInt(String(doc.duration)) || 0,
	}
})

// Only the fields the card shows: an exercise's test cases (and their expected
// output) are never requested.
const fetchDetails = async (): Promise<Details | null> => {
	if (props.kind == 'quiz') {
		const doc = await call<QuizDetails>('frappe.client.get', {
			doctype: 'LMS Quiz',
			name: props.name,
		})
		return doc ? { kind: 'quiz', doc } : null
	}
	if (props.kind == 'assignment') {
		const doc = await call<AssignmentSummary | null>(
			'frappe.client.get_value',
			{
				doctype: 'LMS Assignment',
				filters: { name: props.name },
				fieldname: ['title', 'question', 'type'],
			}
		)
		return doc ? { kind: 'assignment', doc } : null
	}
	const doc = await call<ExerciseSummary | null>('frappe.client.get_value', {
		doctype: 'LMS Programming Exercise',
		filters: { name: props.name },
		fieldname: ['title', 'problem_statement', 'language'],
	})
	return doc ? { kind: 'exercise', doc } : null
}

onMounted(async () => {
	details.value = await fetchDetails().catch(() => null)
	loading.value = false
})
</script>
