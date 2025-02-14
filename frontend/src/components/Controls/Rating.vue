<template>
	<div class="space-y-1">
		<label class="block text-xs text-ink-gray-5" v-if="props.label">
			{{ props.label }}
		</label>
		<div class="flex text-center">
			<div
				v-for="index in 5"
				@mouseover="hoveredRating = index"
				@mouseleave="hoveredRating = 0"
			>
				<Star
					class="fill-gray-400 text-gray-50 stroke-1 mr-1 cursor-pointer"
					:class="iconClasses(index)"
					@click="markRating(index)"
				/>
			</div>
		</div>
	</div>
</template>

<script setup>
import { Star } from 'lucide-vue-next'
import { ref, watch } from 'vue'

const props = defineProps({
	id: {
		type: String,
		default: '',
	},
	modelValue: {
		type: Number,
		default: 0,
	},
	label: {
		type: String,
		default: '',
	},
	size: {
		type: String,
		default: 'md',
	},
})

const iconClasses = (index) => {
	let classes = [
		{
			sm: 'size-4',
			md: 'size-5',
			lg: 'size-6',
			xl: 'size-7',
		}[props.size],
	]
	if (index <= hoveredRating.value && index > rating.value) {
		classes.push('fill-yellow-200')
	} else if (index <= rating.value) {
		classes.push('fill-yellow-500')
	}
	return classes.join(' ')
}

const emit = defineEmits(['update:modelValue'])
const rating = ref(props.modelValue)
const hoveredRating = ref(0)

let emitChange = (value) => {
	emit('update:modelValue', value)
}

function markRating(index) {
	emitChange(index)
	rating.value = index
}

watch(
	() => props.modelValue,
	(newVal) => {
		rating.value = newVal
	}
)
</script>
