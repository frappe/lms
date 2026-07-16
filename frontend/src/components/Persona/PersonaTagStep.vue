<template>
	<div class="flex flex-wrap gap-x-4 gap-y-3.5">
		<Button
			v-for="option in step.options"
			:key="String(option.value)"
			variant="outline"
			size="sm"
			:class="
				value === option.value
					? '!border-outline-gray-3 !bg-surface-gray-4'
					: ''
			"
			:aria-pressed="value === option.value"
			@click="toggle(option)"
		>
			<template v-if="option.icon" #prefix>
				<PersonaToolIcon :name="option.icon" />
			</template>
			{{ option.label }}
			<template v-if="value === option.value" #suffix>
				<LucideX class="size-3.5 text-ink-gray-6" />
			</template>
		</Button>
	</div>
</template>

<script setup>
import PersonaToolIcon from '@/components/PersonaToolIcon.vue'
import { Button } from 'frappe-ui'

const props = defineProps({
	step: {
		type: Object,
		required: true,
	},
	value: {
		type: [String, Number, Boolean],
		default: null,
	},
})

const emit = defineEmits(['select', 'deselect'])

function toggle(option) {
	if (props.value === option.value) {
		emit('deselect', option)
	} else {
		emit('select', option)
	}
}
</script>
