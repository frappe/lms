<template>
	<div v-if="feedbackList.data"></div>
	<div v-else class="space-y-8">
		<div class="grid grid-cols-4 gap-5">
			<Rating v-model="feedback.content" :label="__('Content')" />
			<Rating v-model="feedback.delivery" :label="__('Delivery')" />
			<Rating v-model="feedback.instructors" :label="__('Instructors')" />
			<Rating v-model="feedback.value" :label="__('Value')" />
		</div>
		<FormControl
			v-model="feedback.feedback"
			type="textarea"
			:label="__('Feedback')"
			rows="7"
		/>
	</div>
</template>
<script setup lang="ts">
import { inject, reactive } from 'vue'
import { createListResource, FormControl, Rating } from 'frappe-ui'

const user = inject('$user')
const feedback = reactive({
	content: 0,
	delivery: 0,
	instructors: 0,
	value: 0,
	feedback: '',
})

const props = defineProps({
	batch: {
		type: String,
		required: true,
	},
})

const feedbackList = createListResource({
	doctype: 'LMS Batch Feedback',
	filters: {
		batch: props.batch,
		member: user.data?.name,
	},
	cache: ['feedbackList', props.batch, user.data?.name],
	auto: true,
})
</script>
