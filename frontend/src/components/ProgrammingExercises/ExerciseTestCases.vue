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
				v-for="result in visible"
				:key="result.idx"
				data-testid="test-case-row"
				class="space-y-1 rounded-6 border border-outline-gray-2 p-2.5"
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
					<span
						class="min-w-0 flex-1 truncate font-mono text-base text-ink-gray-9"
					>
						{{ result.input }}
					</span>
					<span
						v-if="result.elapsed !== null"
						class="shrink-0 text-base text-ink-gray-6"
					>
						{{ __('{0}s').format(result.elapsed.toFixed(2)) }}
					</span>
				</div>
				<div class="flex items-baseline gap-x-2 ms-6">
					<span class="shrink-0 text-base text-ink-gray-6">
						{{ __('Expected') }}
					</span>
					<span class="font-mono text-base text-ink-gray-8">
						{{ result.expected_output }}
					</span>
				</div>
				<p
					v-if="result.status === 'Failed' && result.output"
					class="whitespace-pre-wrap break-words text-p-base text-ink-gray-6 ms-6"
				>
					{{ result.output }}
				</p>
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

const visible = computed(() => props.results.filter((r) => !r.hidden))
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
