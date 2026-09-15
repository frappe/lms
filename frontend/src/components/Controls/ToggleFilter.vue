<template>
	<Tooltip v-if="!isMobile" :text="tooltip" class="!w-fit shrink-0">
		<Checkbox
			:modelValue="modelValue"
			:label="label"
			@update:modelValue="set(Boolean($event))"
		/>
	</Tooltip>
	<Checkbox
		v-else
		:modelValue="modelValue"
		:label="mobileLabel || label"
		:description="tooltip || undefined"
		size="md"
		@update:modelValue="set(Boolean($event))"
	/>
</template>

<script setup lang="ts">
import { nextTick } from 'vue'
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

const props = withDefaults(
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

// frappe-ui's Checkbox reports one click twice: onChange assigns its
// defineModel and then re-emits update:modelValue (Checkbox.vue:76-77). Both
// emits happen in the same tick, so `modelValue` has not round-tripped by the
// second one and comparing against it alone lets the echo through, which
// costs the page a second list request. Remember what was just sent instead.
let sent: boolean | null = null

function set(value: boolean): void {
	if (value === props.modelValue || value === sent) return
	sent = value
	emit('update:modelValue', value)
	nextTick(() => {
		sent = null
	})
}
</script>
