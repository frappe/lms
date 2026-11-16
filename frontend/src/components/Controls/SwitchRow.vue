<template>
	<div data-testid="switch-row" class="flex items-center justify-between gap-3">
		<div class="flex min-w-0 flex-col gap-1">
			<div class="flex items-center gap-1.5">
				<label
					:id="labelId"
					:for="switchId"
					data-testid="switch-label"
					class="select-none text-p-base font-medium text-ink-gray-8"
					:class="cursor"
				>
					<slot name="label">{{ label }}</slot>
				</label>
				<CautionIcon v-if="caution" :text="caution" />
			</div>
			<label
				v-if="hasDescription"
				:id="descriptionId"
				:for="switchId"
				data-testid="switch-description"
				class="select-none text-p-sm text-ink-gray-6"
				:class="cursor"
			>
				<slot name="description">{{ description }}</slot>
			</label>
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
import CautionIcon from '@/components/Controls/CautionIcon.vue'

defineOptions({ inheritAttrs: false })

const props = defineProps<{
	label: string
	description?: string
	/** Shown behind an alert icon, outside the label so a click on it does not toggle. */
	caution?: string
	disabled?: boolean
}>()

const model = defineModel<boolean>({ default: false })
const slots = useSlots()

const switchId = useId()
const labelId = useId()
const descriptionId = useId()

const cursor = computed(() =>
	props.disabled ? 'cursor-not-allowed' : 'cursor-pointer'
)

const hasDescription = computed(() =>
	Boolean(props.description || slots.description)
)
</script>
