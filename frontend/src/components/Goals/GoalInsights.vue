<template>
	<div
		v-if="struggles.length || insights.missed_questions.length"
		class="mt-4 rounded-5 bg-surface-amber-1 p-3 text-p-sm"
	>
		<div class="flex items-center gap-1.5 text-p-xs text-ink-amber-7">
			<span class="lucide-lightbulb size-3.5" aria-hidden="true" />
			{{ __('Where students struggle') }}
		</div>
		<ul v-if="struggles.length" class="mt-2 space-y-1.5">
			<li v-for="idea in struggles" :key="idea.heading" class="text-ink-gray-8">
				<span class="text-ink-gray-9">{{ idea.heading }}</span>
				<span class="text-ink-gray-6"> · {{ describe(idea) }}</span>
			</li>
		</ul>
		<div v-if="insights.missed_questions.length" class="mt-3">
			<div class="text-p-xs text-ink-gray-6">
				{{ __('Missed most in the final check') }}
			</div>
			<ul class="mt-1 space-y-1.5">
				<li
					v-for="question in insights.missed_questions"
					:key="question.question"
					class="text-ink-gray-8"
				>
					{{ question.question }}
					<span class="text-p-xs text-ink-gray-6">
						·
						{{
							__('{0} of {1} missed').format(question.missed, question.attempts)
						}}
						<template v-if="question.source">· {{ question.source }}</template>
					</span>
				</li>
			</ul>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface IdeaInsight {
	heading: string
	needed_teaching: number
	confidently_wrong: number
}

export interface Insights {
	learners: number
	ideas: IdeaInsight[]
	missed_questions: {
		question: string
		source?: string
		missed: number
		attempts: number
	}[]
}

const props = defineProps<{ insights: Insights }>()

// Confident mistakes first: those are the misconceptions people would act on at work.
const struggles = computed(() =>
	props.insights.ideas
		.filter((idea) => idea.needed_teaching || idea.confidently_wrong)
		.sort(
			(a, b) =>
				b.confidently_wrong - a.confidently_wrong ||
				b.needed_teaching - a.needed_teaching
		)
		.slice(0, 3)
)

const describe = (idea: IdeaInsight) =>
	[
		idea.confidently_wrong
			? __('{0} of {1} were confidently wrong').format(
					idea.confidently_wrong,
					props.insights.learners
			  )
			: '',
		idea.needed_teaching
			? __('{0} of {1} needed it taught').format(
					idea.needed_teaching,
					props.insights.learners
			  )
			: '',
	]
		.filter(Boolean)
		.join(', ')
</script>
