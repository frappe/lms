<template>
	<div v-if="user.data?.is_student">
		<div>
			<div class="leading-5 mb-4">
				<div v-if="readOnly">
					{{ __('Thank you for providing your feedback.') }}
					<span
						@click="showFeedbackForm = !showFeedbackForm"
						class="underline cursor-pointer"
						>{{ __('Click here') }}</span
					>
					{{ __('to view your feedback.') }}
				</div>
				<div v-else>
					{{ __('Help us improve by providing your feedback.') }}
				</div>
			</div>
			<div class="space-y-4" :class="showFeedbackForm ? 'block' : 'hidden'">
				<div class="space-y-4">
					<Rating
						v-for="key in ratingKeys"
						v-model="feedback[key]"
						:label="__(convertToTitleCase(key))"
						:readonly="readOnly"
					/>
				</div>
				<FormControl
					v-model="feedback.feedback"
					type="textarea"
					:label="__('Feedback')"
					:rows="9"
					:readonly="readOnly"
				/>
				<Button v-if="!readOnly" @click="submitFeedback">
					{{ __('Submit Feedback') }}
				</Button>
			</div>
		</div>
	</div>

	<div v-else-if="feedbackList.data?.length">
		<div class="leading-5 text-sm mb-2 mt-5">
			{{ __('Average Feedback Received') }}
		</div>

		<div class="space-y-4">
			<Rating
				v-for="key in ratingKeys"
				v-model="average[key]"
				:label="__(convertToTitleCase(key))"
				:readonly="true"
			/>
		</div>

		<Button variant="outline" class="mt-5" @click="showAllFeedback = true">
			{{ __('View all feedback') }}
		</Button>
	</div>
	<div v-else class="text-ink-gray-7 mt-5 leading-5">
		{{ __('No feedback received yet.') }}
	</div>
	<FeedbackModal
		v-if="feedbackList.data?.length"
		v-model="showAllFeedback"
		:feedbackList="feedbackList.data"
	/>
</template>
<script setup>
import { inject, onMounted, reactive, ref, watch } from 'vue'
import { convertToTitleCase } from '@/utils'
import { Button, createListResource, FormControl, Rating } from 'frappe-ui'
import FeedbackModal from '@/components/Modals/FeedbackModal.vue'

const user = inject('$user')
const ratingKeys = ['content', 'instructors', 'value']
const readOnly = ref(false)
const average = reactive({})
const feedback = reactive({})
const showFeedbackForm = ref(true)
const showAllFeedback = ref(false)

const props = defineProps({
	batch: {
		type: String,
		required: true,
	},
})

onMounted(() => {
	let filters = {
		batch: props.batch,
	}
	if (user.data?.is_student) {
		filters['member'] = user.data?.name
	}
	feedbackList.update({
		filters: filters,
	})
	feedbackList.reload()
})

const feedbackList = createListResource({
	doctype: 'LMS Batch Feedback',
	filters: {
		batch: props.batch,
	},
	fields: [
		'content',
		'instructors',
		'value',
		'feedback',
		'name',
		'member',
		'member_name',
		'member_image',
	],
	cache: ['feedbackList', props.batch, user.data?.name],
})

watch(
	() => feedbackList.data,
	() => {
		if (feedbackList.data.length) {
			let data = feedbackList.data
			readOnly.value = true
			showFeedbackForm.value = false

			ratingKeys.forEach((key) => {
				average[key] = 0
			})

			data.forEach((row) => {
				Object.keys(row).forEach((key) => {
					if (ratingKeys.includes(key)) row[key] = row[key] * 5
					feedback[key] = row[key]
				})
				ratingKeys.forEach((key) => {
					average[key] += row[key]
				})
			})
			Object.keys(average).forEach((key) => {
				average[key] = average[key] / data.length
			})
		}
	}
)

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
				showFeedbackForm.value = false
			},
		}
	)
}
</script>
<style>
.feedback-list > button > div {
	align-items: start;
	padding: 0.15rem 0;
}
</style>
