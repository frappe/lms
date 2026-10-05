<template>
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
