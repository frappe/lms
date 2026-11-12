<template>
	<div class="space-y-4">
		<div v-if="loading" class="space-y-3">
			<div
				v-for="i in 3"
				:key="i"
				class="h-32 animate-pulse rounded-7 bg-surface-gray-2"
			/>
		</div>
		<div
			v-for="(question, q) in questions"
			:key="q"
			class="rounded-7 border border-outline-gray-2 bg-surface-base p-5"
		>
			<div class="mb-3 text-base-medium text-ink-gray-9">
				{{ q + 1 }}. {{ question.question }}
			</div>
			<div
				class="space-y-1.5"
				role="radiogroup"
				:aria-label="question.question"
			>
				<button
					v-for="(option, o) in question.options"
					:key="o"
					type="button"
					role="radio"
					:aria-checked="answers[q] === o"
					:disabled="!!result"
					class="flex w-full items-center gap-2.5 rounded-5 border px-3 py-2 text-start text-p-sm transition-colors"
					:class="optionClass(q, o)"
					@click="answers[q] = o"
				>
					<span class="size-4 shrink-0" :class="optionIcon(q, o)" />
					<span class="text-ink-gray-8">{{ option }}</span>
				</button>
			</div>
			<p v-if="result" class="mt-3 text-p-sm text-ink-gray-6">
				{{ result.marks[q].explanation }}
				<SourceTag :source="result.marks[q].source" />
			</p>
		</div>
		<div
			v-if="result"
			class="rounded-7 p-4 text-p-sm"
			:class="
				result.passed
					? 'bg-surface-green-1 text-ink-green-8'
					: 'bg-surface-amber-1 text-ink-amber-8'
			"
		>
			<span class="text-base-medium">{{
				__('You scored {0}%.').format(result.score)
			}}</span>
			{{
				result.passed
					? __('Nice work.')
					: __('Look over the explanations, then give it another go.')
			}}
		</div>
		<div class="flex justify-end gap-2">
			<template v-if="result">
				<Button v-if="!result.passed" @click="load(true)">{{
					__('Try again')
				}}</Button>
				<Button variant="solid" @click="emit('next')">{{
					__('Continue')
				}}</Button>
			</template>
			<Button
				v-else-if="questions.length"
				variant="solid"
				:disabled="!complete"
				:loading="submitting"
				@click="submit"
			>
				{{ __('Check my answers') }}
			</Button>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Button, call, toast } from 'frappe-ui'
import SourceTag from '@/components/Goals/SourceTag.vue'

const props = defineProps<{
	activity: Record<string, any>
	assignment: string
}>()
const emit = defineEmits<{
	next: []
	answered: [state: Record<string, unknown>]
}>()

interface Mark {
	correct: boolean
	answer_index: number
	explanation: string
	source?: string
}

const questions = ref<{ question: string; options: string[] }[]>([])
const answers = ref<(number | null)[]>([])
const result = ref<{ score: number; passed: number; marks: Mark[] } | null>(
	null
)
const submitting = ref(false)
const loading = ref(false)

// Each learner gets their own questions from the skill's bank; a retry picks again.
const load = async (fresh = false) => {
	loading.value = true
	result.value = null
	try {
		questions.value = await call('lms.lms.ai.api.start_check', {
			assignment: props.assignment,
			index: props.activity.index,
			fresh,
		})
		answers.value = questions.value.map(() => null)
	} catch (err) {
		toast.error((err as Error).message)
	} finally {
		loading.value = false
	}
}
watch(
	() => props.activity.index,
	() => load(),
	{ immediate: true }
)

const complete = computed(() =>
	answers.value.every((answer) => answer !== null)
)

const submit = async () => {
	submitting.value = true
	try {
		const response = await call('lms.lms.ai.api.submit_activity', {
			assignment: props.assignment,
			index: props.activity.index,
			response: { answers: answers.value },
		})
		result.value = response
		emit('answered', response.state)
	} finally {
		submitting.value = false
	}
}

const optionClass = (q: number, o: number) => {
	if (!result.value)
		return answers.value[q] === o
			? 'border-outline-gray-4 bg-surface-gray-2'
			: 'border-outline-gray-1 bg-surface-base hover:border-outline-gray-3'
	const mark = result.value.marks[q]
	if (o === mark.answer_index)
		return 'border-outline-green-2 bg-surface-green-1'
	if (o === answers.value[q]) return 'border-outline-amber-2 bg-surface-amber-1'
	return 'border-outline-gray-1 bg-surface-base opacity-60'
}

const optionIcon = (q: number, o: number) => {
	if (!result.value)
		return answers.value[q] === o
			? 'lucide-circle-dot text-ink-gray-8'
			: 'lucide-circle text-ink-gray-6'
	const mark = result.value.marks[q]
	if (o === mark.answer_index) return 'lucide-circle-check text-ink-green-6'
	if (o === answers.value[q]) return 'lucide-circle-x text-ink-amber-6'
	return 'lucide-circle text-ink-gray-6'
}
</script>
