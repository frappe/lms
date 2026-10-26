<template>
<<<<<<< HEAD
=======
	<SwitchRow
		v-if="label"
		:label="label"
		:description="description"
		:caution="caution"
		:disabled="disabled"
		:model-value="!!modelValue"
		@update:model-value="onUpdate"
		v-bind="$attrs"
	/>
>>>>>>> c37a51f (refactor(settings): render settings switches through SwitchRow)
	<FUISwitch
		:model-value="!!modelValue"
		@update:model-value="onUpdate"
		v-bind="$attrs"
	/>
</template>

<script setup lang="ts">
import { Switch as FUISwitch } from 'frappe-ui'

const props = defineProps<{
	modelValue: number | boolean | null | undefined
<<<<<<< HEAD
=======
	label?: string
	description?: string
	caution?: string
	disabled?: boolean
>>>>>>> c37a51f (refactor(settings): render settings switches through SwitchRow)
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
