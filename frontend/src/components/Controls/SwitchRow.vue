<template>
	<div
		data-testid="switch-row"
		class="group flex items-center gap-3 rounded-4 transition-colors"
		:class="rowClasses"
		v-bind="rowAttrs"
		@click="onRowClick"
	>
		<div class="flex min-w-0 flex-col gap-1">
			<div class="flex items-center gap-1.5">
				<label
					:id="labelId"
					:for="switchId"
					data-testid="switch-label"
					class="select-none"
					:class="[labelClasses, cursor]"
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
			v-bind="switchAttrs"
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
import { computed, useAttrs, useId, useSlots } from 'vue'
import type { HTMLAttributes } from 'vue'
import CautionIcon from '@/components/Controls/CautionIcon.vue'

/** A labelled switch whose whole row toggles it. */
defineOptions({ inheritAttrs: false })

const props = withDefaults(
	defineProps<{
		label: string
		description?: string
		/** Shown behind an alert icon, outside the label so a click on it does not toggle. */
		caution?: string
		disabled?: boolean
		/** `inline` bleeds its hover past the content; `row` fills a settings list row, padded by the caller; `compact` is a card fact line. */
		variant?: 'inline' | 'row' | 'compact'
		/** `start` puts the switch before the label. */
		controlPosition?: 'start' | 'end'
	}>(),
	{ variant: 'inline', controlPosition: 'end' }
)

const model = defineModel<boolean>({ default: false })
const slots = useSlots()
const attrs = useAttrs()

const switchId = useId()
const labelId = useId()
const descriptionId = useId()

const VARIANT_CLASSES = {
	inline: '-m-2 p-2',
	row: '-mx-2 px-2',
	compact: 'h-7 px-2',
}

const rowAttrs = computed(
	() => ({ class: attrs.class, style: attrs.style } as HTMLAttributes)
)

const switchAttrs = computed(() => {
	const { class: _class, style: _style, ...rest } = attrs
	return rest
})

const rowClasses = computed(() => [
	VARIANT_CLASSES[props.variant],
	props.controlPosition === 'start'
		? 'w-fit flex-row-reverse justify-end'
		: 'justify-between',
	props.disabled
		? 'cursor-not-allowed'
		: 'cursor-pointer hover:bg-surface-gray-2',
])

const labelClasses = computed(() =>
	props.variant === 'compact' ? '' : 'text-p-base font-medium text-ink-gray-8'
)

const cursor = computed(() =>
	props.disabled ? 'cursor-not-allowed' : 'cursor-pointer'
)

const hasDescription = computed(() =>
	Boolean(props.description || slots.description)
)

function onRowClick(event: MouseEvent) {
	if (props.disabled) return
	// Labels forward their click to the switch, and the switch and other controls handle their own.
	const target = event.target as Element
	if (target.closest('label, button, a, input, [role="switch"]')) return
	model.value = !model.value
}
</script>
