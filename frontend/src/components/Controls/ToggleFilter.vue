<template>
	<!-- One boolean filter, declared once by the page. A checkbox row is the
	     desk idiom but does not survive a 390px header, so the same filter is a
	     pressable chip on a phone. Which control that is stops being the page's
	     business. Mirrors helpdesk's QuickFilterField.vue, which likewise picks
	     the control from the filter's declaration. -->
	<Tooltip v-if="!isMobile" :text="tooltip">
		<Checkbox
			:modelValue="modelValue"
			:label="label"
			@update:modelValue="set(Boolean($event))"
		/>
	</Tooltip>
	<!-- A phone has no hover, so the desk's tooltip has nowhere to live. Rather
	     than give the chip a second control to explain it, the chip says what it
	     does: `mobileLabel` is the whole sentence shortened to a name. -->
	<FilterChip
		v-else
		:active="modelValue"
		:theme="theme"
		@click="set(!modelValue)"
	>
		{{ mobileLabel || label }}
	</FilterChip>
</template>

<script setup lang="ts">
import { nextTick } from 'vue'
import { Checkbox, Tooltip } from 'frappe-ui'
import FilterChip from './FilterChip.vue'
import type { FilterChipTheme } from '@/types'
import { useScreenSize } from '@/utils/composables'

const props = withDefaults(
	defineProps<{
		modelValue: boolean
		label: string
		/** Hovered on the desk control; a phone gets `mobileLabel` instead. */
		tooltip?: string
		/**
		 * What the chip is called on a phone. The desk label sits beside a
		 * tooltip that carries the rest of the meaning, so it can be a bare
		 * noun; the chip has to say the whole thing itself.
		 */
		mobileLabel?: string
		theme?: FilterChipTheme
	}>(),
	{ tooltip: '', mobileLabel: '', theme: 'gray' }
)

const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const { isMobile } = useScreenSize()

// frappe-ui's Checkbox reports one click twice: onChange assigns its
// defineModel and then re-emits update:modelValue (Checkbox.vue:76-77). Both
// emits happen in the same tick, so `modelValue` has not round-tripped by the
// second one and comparing against it alone lets the echo through — which
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
