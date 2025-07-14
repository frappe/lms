<template>
	<div>
		<div class="mb-1.5 text-sm text-ink-gray-7">
			{{ __(label) }}
		</div>
		<div class="flex items-center">
			{{ tags }}
			<div
				v-for="tag in tags?.split(', ')"
				class="flex items-center bg-surface-gray-2 p-2 rounded-md mr-2"
			>
				{{ tag }}
				<X
					class="stroke-1.5 w-3 h-3 ml-2 cursor-pointer"
					@click="removeTag(tag)"
				/>
			</div>
			<FormControl v-model="newTag" @keyup.enter="updateTags()" />
		</div>
	</div>
</template>
<script setup>
import { FormControl } from 'frappe-ui'
import { X } from 'lucide-vue-next'
import { ref } from 'vue'

const props = defineProps({
	modelValue: {
		type: String,
		default: '',
	},
	label: {
		type: String,
		default: 'Tags',
	},
})
let tags = ref(props.modelValue)
const emit = defineEmits(['update:modelValue'])
let newTag = ref('')

let emitChange = (value) => {
	emit('update:modelValue', value)
}

const updateTags = () => {
	if (newTag) {
		tags.value = tags.value ? `${tags.value}, ${newTag}` : newTag
		newTag.value = ''
		emitChange(tags.value)
	}
}

const removeTag = (tag) => {
	tags.value = tags.value.replace(tag, '').replace(', ,', ',')
	emitChange(tags.value)
}
</script>
