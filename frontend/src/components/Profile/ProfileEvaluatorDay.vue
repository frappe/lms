<template>
	<div
		class="grid grid-cols-1 items-start gap-x-4 gap-y-3 px-4 py-3.5 sm:grid-cols-[7rem_8rem_minmax(0,1fr)_auto]"
	>
		<span
			class="flex h-7 items-center text-base font-medium"
			:class="ranges.length ? 'text-ink-gray-7' : 'text-ink-gray-6'"
		>
			{{ __(day) }}
		</span>
		<span
			class="hidden h-7 items-center text-base text-ink-gray-6 sm:flex"
			data-testid="total"
		>
			{{ dayTotal(ranges) }}
		</span>
		<div
			v-if="canEdit || ranges.length"
			class="flex min-w-0 flex-col items-start gap-2 sm:col-start-3"
		>
			<p
				v-if="!canEdit"
				class="flex min-h-7 items-center text-base text-ink-gray-8"
			>
				{{ ranges.map(formatRange).join(', ') }}
			</p>
			<ul v-else-if="ranges.length" class="flex w-full flex-col gap-2">
				<li v-for="range in ranges" :key="range.key" data-testid="range">
					<div class="flex items-center gap-2">
						<label class="sr-only" :for="fieldId(range, 'start')">
							{{ __('{0} start time').format(__(day)) }}
						</label>
						<FormControl
							:id="fieldId(range, 'start')"
							v-model="range.start"
							type="time"
							variant="outline"
							class="min-w-0 flex-1 sm:w-28 sm:flex-none"
						/>
						<span class="text-p-sm text-ink-gray-6">
							{{ __('to') }}
						</span>
						<label class="sr-only" :for="fieldId(range, 'end')">
							{{ __('{0} end time').format(__(day)) }}
						</label>
						<FormControl
							:id="fieldId(range, 'end')"
							v-model="range.end"
							type="time"
							variant="outline"
							class="min-w-0 flex-1 sm:w-28 sm:flex-none"
						/>
						<Button
							class="shrink-0"
							variant="ghost"
							icon="lucide-x"
							:aria-label="
								__('Remove {0} on {1}').format(formatRange(range), __(day))
							"
							@click="removeRange(range)"
						/>
					</div>
					<ErrorMessage
						v-if="errors[range.key]"
						class="mt-1.5"
						:message="errors[range.key]"
					/>
				</li>
			</ul>
		</div>
		<Button
			v-if="canEdit"
			class="justify-self-start sm:self-end"
			variant="outline"
			:aria-label="__('Add slot for {0}').format(__(day))"
			@click="addRange"
		>
			<template #prefix>
				<span class="lucide-plus size-4" />
			</template>
			<span class="text-p-base">{{ __('Add slot') }}</span>
		</Button>
	</div>
</template>
<script setup lang="ts">
import { Button, ErrorMessage, FormControl } from 'frappe-ui'
import { dayTotal, formatRange, nextRange } from '@/utils/evaluatorAvailability'
import type { TimeRange, Weekday } from '@/utils/evaluatorAvailability'

defineProps<{
	day: Weekday
	canEdit: boolean
	errors: Record<number, string>
}>()

const ranges = defineModel<TimeRange[]>('ranges', { required: true })

const fieldId = (range: TimeRange, edge: 'start' | 'end'): string =>
	`availability-${range.key}-${edge}`

const addRange = () => {
	ranges.value.push(nextRange(ranges.value))
}

const removeRange = (range: TimeRange) => {
	ranges.value = ranges.value.filter((item) => item !== range)
}
</script>
