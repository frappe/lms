<template>
	<div class="space-y-1">
		<label class="block text-xs text-gray-600" v-if="props.label">
			{{ props.label }}
		</label>
		<div class="flex text-center">
			<div v-for="index in 5">
				{{ rating }}
				<Star
					:class="index <= rating ? 'fill-orange-500' : ''"
					class="h-6 w-6 fill-gray-400 text-gray-50 mr-1 cursor-pointer"
					@click="markRating(index)"
				/>
			</div>
		</div>
	</div>
</template>

<script setup>
import { Star } from 'lucide-vue-next'
import { ref } from 'vue'

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
let rating = ref(props.modelValue)
console.log(props.modelValue)
let emitChange = (value) => {
	emit('update:modelValue', value)
}

function markRating(index) {
	emitChange(index)
	rating.value = index
}
</script>
