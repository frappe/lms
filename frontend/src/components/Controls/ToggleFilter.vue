<template>
	<Tooltip v-if="!isMobile" :text="tooltip">
		<span
			class="inline-flex !w-fit shrink-0"
			@focusin="relayFocus"
			@focusout="relayFocus"
		>
			<Checkbox
				:modelValue="modelValue"
				:label="label"
				:aria-description="tooltip || undefined"
				@update:modelValue="emit('update:modelValue', Boolean($event))"
			/>
		</span>
	</Tooltip>
	<Checkbox
		v-else
		:modelValue="modelValue"
		:label="mobileLabel || label"
		:description="tooltip || undefined"
		size="md"
		@update:modelValue="emit('update:modelValue', Boolean($event))"
	/>
</template>

<script setup lang="ts">
import { Checkbox, Tooltip } from 'frappe-ui'
import { useScreenSize } from '@/utils/composables'

// One boolean filter, declared once by the page. Which control it becomes stops
// being the page's business. Mirrors helpdesk's QuickFilterField.vue, which
// likewise picks the control from the filter's declaration.
//
// A phone gets a checkbox too, not a chip.
//
// Filters now live in a sheet rather than a strip across the header (see
// PageBody), so the reason the chip existed — a checkbox row does not survive a
// 390px header — is gone, and the sheet has room for the desk idiom.
//
// The checkbox is also the better target: frappe-ui renders it as an <input>
// plus a <label for>, so the label is part of the hit area natively. A chip
// carried its text as a <button> child with no such association.
//
// The desk's tooltip has nowhere to live on a phone, so it becomes the
// checkbox's description instead of being dropped.
//
// The span is the Tooltip trigger. Checkbox passes fallthrough attrs to its
// <input>, so the trigger's data-state/data-slot would overwrite the input's.
// focus/blur do not bubble, so the span replays the input's focusin/focusout.

withDefaults(
	defineProps<{
		modelValue: boolean
		label: string
		/** Hovered on the desk control; a phone gets `mobileLabel` instead. */
		tooltip?: string
		/**
		 * What the filter is called on a phone. The desk label sits beside a
		 * tooltip that carries the rest of the meaning, so it can be a bare
		 * noun; in the sheet the label has to say the whole thing itself.
		 */
		mobileLabel?: string
	}>(),
	{ tooltip: '', mobileLabel: '' }
)

const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const { isMobile } = useScreenSize()

function relayFocus(event: FocusEvent): void {
	const type = event.type === 'focusin' ? 'focus' : 'blur'
	event.currentTarget?.dispatchEvent(new FocusEvent(type))
}
</script>
