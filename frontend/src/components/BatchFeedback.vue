<template>
	<div>
		<div
			v-if="feedbackList.data?.length"
			class="bg-blue-100 text-blue-700 p-2 rounded-md mb-5"
		>
			{{ __('Thank you for providing your feedback!') }}
		</div>
		<div v-else class="flex justify-between items-center mb-5">
			<div class="text-lg font-semibold">
				{{ __('Help Us Improve') }}
			</div>
			<Button @click="submitFeedback()">
				{{ __('Submit') }}
			</Button>
		</div>
		<div class="space-y-8">
			<div class="grid grid-cols-4 gap-5">
				<Rating
					v-model="feedback.content"
					:label="__('Content')"
					:readonly="readOnly"
				/>
				<Rating
					v-model="feedback.delivery"
					:label="__('Delivery')"
					:readonly="readOnly"
				/>
				<Rating
					v-model="feedback.instructors"
					:label="__('Instructors')"
					:readonly="readOnly"
				/>
				<Rating
					v-model="feedback.value"
					:label="__('Value')"
					:readonly="readOnly"
				/>
			</div>
			<FormControl
				v-model="feedback.feedback"
				type="textarea"
				:label="__('Feedback')"
				:rows="7"
				:readonly="readOnly"
			/>
		</div>
	</div>
</template>
<script setup>
import { inject, reactive, ref } from 'vue'
import { Button, createListResource, FormControl, Rating } from 'frappe-ui'

const user = inject('$user')
const ratingKeys = ['content', 'delivery', 'instructors', 'value']
const readOnly = ref(false)
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
	fields: ['content', 'delivery', 'instructors', 'value', 'feedback', 'name'],
	cache: ['feedbackList', props.batch, user.data?.name],
	auto: true,
	onSuccess(data) {
		if (data.length) {
			readOnly.value = true
			Object.keys(feedback).forEach((key) => {
				if (ratingKeys.includes(key)) feedback[key] = data[0][key] * 5
				else feedback[key] = data[0][key]
			})
		}
	},
})

const submitFeedback = () => {
	ratingKeys.forEach((key) => {
		feedback[key] = feedback[key] / 5
	})
	feedbackList.insert.submit(
		{
			member: user.data?.name,
			batch: props.batch,
			...feedback,
		},
		{
			onSuccess: () => {
				feedbackList.reload()
			},
		}
	)
}
</script>
