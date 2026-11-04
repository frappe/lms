<template>
	<SwitchRow
		v-if="label"
		:label="label"
		:description="description"
		:disabled="disabled"
		:model-value="!!modelValue"
		@update:model-value="onUpdate"
		v-bind="$attrs"
	/>
	<FUISwitch
		v-else
		:model-value="!!modelValue"
		:disabled="disabled"
		@update:model-value="onUpdate"
		v-bind="$attrs"
	/>
</template>

<script setup lang="ts">
import { Switch as FUISwitch } from 'frappe-ui'
import SwitchRow from '@/components/Controls/SwitchRow.vue'

const props = defineProps<{
	modelValue: number | boolean | null | undefined
	label?: string
	description?: string
	disabled?: boolean
}>()

const emit = defineEmits<{
	'update:modelValue': [value: number | boolean]
	change: [value: number | boolean]
}>()

defineOptions({ inheritAttrs: false })

function onUpdate(v: boolean) {
	const out = typeof props.modelValue === 'boolean' ? v : v ? 1 : 0
	emit('update:modelValue', out)
	emit('change', out)
}
</script>
