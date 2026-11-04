<template>
	<div data-testid="switch-row" class="flex items-center justify-between gap-3">
		<div class="flex min-w-0 flex-col gap-1">
			<label
				:id="labelId"
				:for="switchId"
				data-testid="switch-label"
				class="select-none text-p-base font-medium text-ink-gray-8"
				:class="disabled ? 'cursor-not-allowed' : 'cursor-pointer'"
			>
				<slot name="label">{{ label }}</slot>
			</label>
			<p
				v-if="hasDescription"
				:id="descriptionId"
				data-testid="switch-description"
				class="text-p-sm text-ink-gray-6"
			>
				<slot name="description">{{ description }}</slot>
			</p>
		</div>
		<Switch
			v-model="model"
			v-bind="$attrs"
			:id="switchId"
			class="shrink-0"
			:disabled="disabled"
			:aria-labelledby="labelId"
			:aria-describedby="hasDescription ? descriptionId : undefined"
		/>
	</div>
</template>

<script setup lang="ts">
import { Switch } from 'frappe-ui'
import { computed, useId, useSlots } from 'vue'

defineOptions({ inheritAttrs: false })

const props = defineProps<{
	label: string
	description?: string
	disabled?: boolean
}>()

const model = defineModel<boolean>({ default: false })
const slots = useSlots()

const switchId = useId()
const labelId = useId()
const descriptionId = useId()

const hasDescription = computed(() =>
	Boolean(props.description || slots.description)
)
</script>
