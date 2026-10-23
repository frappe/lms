<template>
	<span class="sr-only" role="status" aria-live="polite">
		{{ count ? selectedText : '' }}
	</span>
	<Transition
		enter-active-class="duration-300 ease-out"
		enter-from-class="transform opacity-0"
		enter-to-class="opacity-100"
		leave-active-class="duration-300 ease-in"
		leave-from-class="opacity-100"
		leave-to-class="transform opacity-0"
	>
		<div
			v-if="count"
			data-testid="selection-banner"
			role="region"
			:aria-label="__('Selected students')"
			class="absolute inset-x-3 bottom-6 z-20 mx-auto max-w-[596px] text-base"
		>
			<div
				class="flex items-center gap-3 rounded-6 bg-surface-elevation-2 px-4 py-2 shadow-2xl"
			>
				<div
					class="flex flex-1 justify-between border-e border-outline-gray-2 text-ink-gray-9"
				>
					<div class="flex items-center gap-3">
						<span class="inline-flex" aria-hidden="true">
							<Checkbox
								:modelValue="true"
								:disabled="true"
								class="text-ink-gray-9"
							/>
						</span>
						<div data-testid="selection-count">{{ selectedText }}</div>
					</div>
					<div class="me-3 flex items-center gap-1">
						<Tooltip v-if="paid" :text="resetLabel">
							<Button
								data-testid="selection-reset"
								variant="ghost"
								icon="lucide-rotate-ccw"
								:aria-label="resetLabel"
								@click="emit('reset')"
							/>
						</Tooltip>
						<Tooltip :text="removeLabel">
							<Button
								data-testid="selection-remove"
								variant="ghost"
								icon="lucide-trash-2"
								:aria-label="removeLabel"
								@click="emit('remove')"
							/>
						</Tooltip>
					</div>
				</div>
				<div class="flex items-center gap-1">
					<Button
						data-testid="selection-select-all"
						class="text-ink-gray-7"
						:aria-disabled="allSelected || undefined"
						:class="allSelected ? 'cursor-not-allowed opacity-50' : ''"
						variant="ghost"
						:label="__('Select all')"
						@click="selectAll"
					/>
					<Tooltip :text="clearLabel">
						<Button
							data-testid="selection-clear"
							icon="lucide-x"
							variant="ghost"
							:aria-label="clearLabel"
							@click="emit('clear')"
						/>
					</Tooltip>
				</div>
			</div>
		</div>
	</Transition>
</template>
<script setup lang="ts">
import { Button, Checkbox, Tooltip } from 'frappe-ui'
import { computed } from 'vue'

const props = defineProps<{
	count: number
	total: number
	paid: boolean
}>()

const emit = defineEmits<{
	remove: []
	reset: []
	selectAll: []
	clear: []
}>()

const removeLabel = __('Remove selected students')
const resetLabel = __('Reset details for selected students')
const clearLabel = __('Clear selection')

const selectedText = computed<string>(() =>
	props.count === 1
		? __('1 student selected')
		: __('{0} students selected', [props.count])
)

const allSelected = computed<boolean>(() => props.count >= props.total)

const selectAll = () => {
	if (!allSelected.value) emit('selectAll')
}
</script>
