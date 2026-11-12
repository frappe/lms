<template>
	<div class="space-y-5">
		<div class="rounded-7 border border-outline-gray-2 bg-surface-base p-5">
			<div class="mb-2 flex items-center gap-2 text-p-xs text-ink-gray-6">
				<span class="lucide-git-fork size-3.5" />
				{{ __('What would you do?') }}
			</div>
			<p class="text-p-base text-ink-gray-9">
				{{ activity.content.situation }}
			</p>
		</div>
		<div class="space-y-2" role="radiogroup" :aria-label="__('Choices')">
			<button
				v-for="(choice, i) in activity.content.choices || []"
				:key="i"
				type="button"
				role="radio"
				:aria-checked="picked === i"
				:disabled="result !== null"
				class="flex w-full items-start gap-3 rounded-7 border px-4 py-3 text-start text-p-base transition-colors"
				:class="choiceClass(i)"
				@click="pick(i)"
			>
				<span class="mt-0.5 size-4 shrink-0" :class="choiceIcon(i)" />
				<span class="text-ink-gray-8">{{ choice.text }}</span>
			</button>
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
			<div class="mb-1 text-base-medium">
				{{ result.passed ? __('Right call') : __('Not quite') }}
			</div>
			{{ result.feedback }}
		</div>
		<div class="flex justify-end gap-2">
			<Button
				v-if="!result"
				variant="solid"
				:disabled="picked === null"
				:loading="checking"
				@click="check"
			>
				{{ __('Check') }}
			</Button>
			<Button v-if="result && !result.passed" @click="reset">{{
				__('Try again')
			}}</Button>
			<Button v-if="result" variant="solid" @click="emit('next')">{{
				__('Continue')
			}}</Button>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { Button, call, toast } from 'frappe-ui'

const props = defineProps<{
	activity: Record<string, any>
	assignment: string
}>()
const emit = defineEmits<{
	next: []
	answered: [state: Record<string, unknown>]
}>()

interface Result {
	passed: number
	feedback: string
	correct_choice: number | null
}

const picked = ref<number | null>(null)
const result = ref<Result | null>(null)
const checking = ref(false)

const reset = () => {
	picked.value = null
	result.value = null
}

watch(() => props.activity.index, reset)

const pick = (choice: number) => {
	picked.value = choice
}

const check = async () => {
	if (picked.value === null) return
	checking.value = true
	try {
		const response = (await call('lms.lms.ai.api.submit_activity', {
			assignment: props.assignment,
			index: props.activity.index,
			response: { choice: picked.value },
		})) as Result & { state: Record<string, unknown> }
		result.value = response
		emit('answered', response.state)
	} catch (err) {
		toast.error((err as Error).message)
	} finally {
		checking.value = false
	}
}

const choiceClass = (i: number) => {
	if (!result.value)
		return picked.value === i
			? 'border-outline-gray-5 bg-surface-gray-1'
			: 'border-outline-gray-2 bg-surface-base hover:border-outline-gray-3'
	if (i === result.value.correct_choice)
		return 'border-outline-green-2 bg-surface-green-1'
	if (i === picked.value) return 'border-outline-amber-2 bg-surface-amber-1'
	return 'border-outline-gray-1 bg-surface-base opacity-60'
}

const choiceIcon = (i: number) => {
	if (!result.value)
		return picked.value === i
			? 'lucide-circle-dot text-ink-gray-8'
			: 'lucide-circle text-ink-gray-6'
	if (i === result.value.correct_choice)
		return 'lucide-circle-check text-ink-green-6'
	if (i === picked.value) return 'lucide-circle-x text-ink-amber-6'
	return 'lucide-circle text-ink-gray-6'
}
</script>
