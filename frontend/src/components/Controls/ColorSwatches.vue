<template>
	<div class="space-y-1.5">
		<InputLabel
			v-if="label"
			:id="labelId"
			:for-id="inputId"
			:label="label ? __(label) : undefined"
			:required="required"
		/>
		<Popover side="bottom" class="!block">
			<template #trigger="{ toggle, isOpen }">
				<div class="space-y-2">
					<FormControl
						:id="inputId"
						type="text"
						autocomplete="off"
						class="w-full"
						:placeholder="__('Set Color')"
						@focus="toggle"
						:modelValue="modelValue"
						@update:modelValue="(val: string) => emit('update:modelValue', val)"
					>
						<template #prefix>
							<div
								class="size-4 rounded-full"
								:style="
									modelValue
										? {
												backgroundColor: `var(--${modelValue.toLowerCase()}-400)`,
										  }
										: {}
								"
							>
								<span
									v-if="!modelValue"
									class="lucide-palette size-4 text-ink-gray-5"
								/>
							</div>
						</template>
						<template #suffix>
							<Button
								variant="ghost"
								:label="__('Clear color')"
								@click="emit('update:modelValue', null)"
							>
								<template #icon>
									<span class="lucide-x size-3 text-ink-gray-5" />
								</template>
							</Button>
						</template>
					</FormControl>
				</div>
			</template>
			<template #body="{ close }">
				<div class="rounded-lg bg-surface-base p-3 border w-fit mt-2">
					<div class="text-xs text-ink-gray-5 mb-1.5">
						{{ __('Swatches') }}
					</div>
					<div class="grid grid-cols-7 gap-2">
						<button
							v-for="color in colors"
							:key="color"
							type="button"
							:aria-label="color"
							class="size-5 rounded-full cursor-pointer"
							:style="{
								backgroundColor: `var(--${color.toLowerCase()}-400)`,
							}"
							@click="
								(e) => {
									emit('update:modelValue', color)
									close()
									emit('change', color)
								}
							"
						></button>
					</div>
				</div>
			</template>
		</Popover>
		<InputDescription
			v-if="showDescription"
			:id="descriptionId"
			:description="description ? __(description) : undefined"
		/>
		<InputError v-if="hasError" :id="errorMessageId" :lines="errorLines" />
	</div>
</template>
<script setup lang="ts">
import { Button, FormControl, Popover } from 'frappe-ui'
import {
	InputDescription,
	InputError,
	InputLabel,
	useInputLabeling,
} from '@/components/Form/labeling'
import { computed } from 'vue'

const emit = defineEmits(['update:modelValue', 'change'])

const props = defineProps<{
	modelValue: string
	label: string
	description?: string
	required?: boolean
	error?: string
}>()

const {
	inputId,
	labelId,
	descriptionId,
	errorMessageId,
	hasError,
	errorLines,
	showDescription,
} = useInputLabeling(props)

const colors = computed(() => {
	return [
		'Red',
		'Blue',
		'Green',
		'Amber',
		'Purple',
		'Cyan',
		'Orange',
		'Violet',
		'Pink',
		'Teal',
		'Gray',
		'Yellow',
	]
})
</script>
