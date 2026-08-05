<template>
	<FormControl
		type="textarea"
		:modelValue="value ?? ''"
		:placeholder="step.placeholder"
		@update:modelValue="emit('input', $event)"
	/>
</template>

<script setup>
import { FormControl } from 'frappe-ui'

defineProps({
	step: {
		type: Object,
		required: true,
	},
	value: {
		type: String,
		default: '',
	},
})

const emit = defineEmits(['input'])
</script>
