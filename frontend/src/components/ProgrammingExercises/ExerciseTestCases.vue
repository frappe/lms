<template>
	<div class="space-y-2.5 p-3.5">
		<div class="flex items-center justify-between gap-x-2">
			<span class="text-base text-ink-gray-6">
				{{ summary }}
			</span>
			<Badge
				v-if="results.length"
				size="sm"
				data-testid="test-case-summary"
				:theme="passed === results.length ? 'green' : 'amber'"
			>
				{{ __('{0} of {1} passed').format(passed, results.length) }}
			</Badge>
			<span role="status" class="sr-only">{{ resultStatus }}</span>
		</div>

		<div v-if="results.length" class="space-y-1.5">
			<div
				v-for="(result, index) in results"
				:key="result.idx"
				data-testid="test-case-row"
				class="space-y-2 rounded-6 border border-outline-gray-2 p-2.5"
			>
				<div class="flex items-center gap-x-2">
					<span
						class="size-4 shrink-0"
						:class="
							result.status === 'Passed'
								? 'lucide-circle-check text-ink-green-5'
								: 'lucide-circle-alert text-ink-red-5'
						"
						aria-hidden="true"
					/>
					<span class="sr-only">
						{{ result.status === 'Passed' ? __('Passed') : __('Failed') }}
					</span>
					<span class="min-w-0 flex-1 truncate text-sm-medium text-ink-gray-9">
						{{ __('Case {0}').format(index + 1) }}
					</span>
					<span
						v-if="result.hidden"
						class="flex shrink-0 items-center gap-x-1 text-sm text-ink-gray-6"
					>
						<span class="lucide-lock size-3.5" aria-hidden="true" />
						{{ __('Hidden') }}
					</span>
					<span
						v-if="result.elapsed !== null"
						class="shrink-0 text-sm text-ink-gray-6"
					>
						{{ __('{0}s').format(result.elapsed.toFixed(2)) }}
					</span>
				</div>
				<!-- A hidden case shows its verdict only. Even the learner's own output
				     stays out: for a program that echoes, it would print the input. -->
				<dl
					v-if="!result.hidden"
					class="ms-6 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1"
				>
					<dt class="text-sm text-ink-gray-6">{{ __('Input') }}</dt>
					<dd
						class="whitespace-pre-wrap break-words font-mono text-sm text-ink-gray-8"
					>
						{{ result.input }}
					</dd>
					<dt class="text-sm text-ink-gray-6">{{ __('Expected') }}</dt>
					<dd
						class="whitespace-pre-wrap break-words font-mono text-sm text-ink-gray-8"
					>
						{{ result.expected_output }}
					</dd>
					<dt class="text-sm text-ink-gray-6">{{ __('Your output') }}</dt>
					<dd
						class="whitespace-pre-wrap break-words font-mono text-sm"
						:class="
							result.status === 'Passed' ? 'text-ink-gray-8' : 'text-ink-red-5'
						"
					>
						<template v-if="result.output">{{ result.output }}</template>
						<span v-else class="font-sans italic text-ink-gray-5">
							{{ __('No output') }}
						</span>
					</dd>
				</dl>
			</div>
		</div>
	</div>
</template>

<script lang="ts">
export type TestCaseResult = {
	idx: number
	status: 'Passed' | 'Failed'
	hidden: number
	input?: string
	output: string
	expected_output: string | null
	elapsed: number | null
}
</script>

<script setup lang="ts">
import { computed } from 'vue'
import { Badge } from 'frappe-ui'

const props = defineProps<{
	results: TestCaseResult[]
	duration: number | null
}>()

const passed = computed(
	() => props.results.filter((r) => r.status === 'Passed').length
)

const resultStatus = computed(() =>
	props.results.length
		? __('{0} of {1} passed').format(passed.value, props.results.length)
		: ''
)

const summary = computed(() => {
	if (!props.results.length) {
		return __('Run your code to check the test cases')
	}
	if (props.duration === null) return ''
	return __('Ran in {0}s').format(props.duration.toFixed(2))
})
</script>
