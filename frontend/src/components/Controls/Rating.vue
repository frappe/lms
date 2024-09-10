<template>
	<div class="space-y-1">
		<label class="block text-xs text-gray-600" v-if="props.label">
			{{ props.label }}
		</label>
		<div class="flex text-center">
			<div v-for="index in 5" @mouseover="hoveredRating = index" @mouseleave="hoveredRating = 0">
				<Star
					class="h-6 w-6 fill-gray-400 text-gray-50 stroke-1 mr-1 cursor-pointer"
					:class="{ 'fill-yellow-200': (index <= hoveredRating && index > rating), 'fill-yellow-500': index <= rating }"
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
})

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

watch(() => props.modelValue, (newVal) => {
  rating.value = newVal
})
</script>
