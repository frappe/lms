<template>
	<div>
		<div class="text-lg-semibold text-ink-gray-9 mb-5">
			{{ __('Feedback') }}
		</div>
		<div v-if="user.data?.is_student">
			<LoadError
				v-if="feedbackList.list.error && !feedbackList.data"
				compact
				:error="feedbackList.list.error"
				@retry="feedbackList.reload()"
			/>
			<PanelSkeleton v-else-if="!feedbackList.data" kind="rows" />
			<div v-else>
				<div class="leading-5 mb-4 text-ink-gray-7">
					<div v-if="readOnly">
						{{ __('Thank you for providing your feedback.') }}
						<button
							type="button"
							@click="showFeedbackForm = !showFeedbackForm"
							:aria-expanded="showFeedbackForm"
							class="underline cursor-pointer"
						>
							{{ __('Click here') }}
						</button>
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
							:key="key"
							v-model="feedback[key]"
							:label="__(convertToTitleCase(key))"
							:disabled="readOnly"
						/>
					</div>
					<FormControl
						v-model="feedback.feedback"
						type="textarea"
						:label="__('Feedback')"
						:rows="9"
						:readonly="readOnly"
					/>
					<Button
						v-if="!readOnly"
						:loading="feedbackList.insert.loading"
						@click="submitFeedback"
					>
						{{ __('Submit Feedback') }}
					</Button>
				</div>
			</div>
		</div>

		<div v-else class="text-ink-gray-7 leading-5">
			{{ __('No feedback received yet.') }}
		</div>
	</div>
</template>
<script setup>
import { inject, onMounted, reactive, ref, watch } from 'vue'
import { convertToTitleCase } from '@/utils'
import { Button, createListResource, FormControl, Rating } from 'frappe-ui'
import LoadError from '@/components/LoadError.vue'
import PanelSkeleton from '@/components/Dashboard/PanelSkeleton.vue'

const user = inject('$user')
const ratingKeys = ['content', 'instructors', 'value']
const readOnly = ref(false)
const feedback = reactive({})
const showFeedbackForm = ref(true)

const props = defineProps({
	batch: {
		type: String,
		required: true,
	},
})

// Staff read every response on the admin dashboard; this list is only the
// student's own.
onMounted(() => {
	if (!user.data?.is_student) return
	feedbackList.update({
		filters: { batch: props.batch, member: user.data.name },
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
		if (feedbackList.data?.length) {
			readOnly.value = true
			showFeedbackForm.value = false

			const row = feedbackList.data[0]
			Object.keys(row).forEach((key) => {
				feedback[key] = ratingKeys.includes(key) ? row[key] * 5 : row[key]
			})
		}
	}
)

const submitFeedback = () => {
	if (feedbackList.insert.loading) return
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
				readOnly.value = true
			},
		}
	)
}
</script>
