<template>
	<Dialog
		v-model="show"
		:options="{
			title: __('Write a Review'),
			size: 'xl',
			actions: [
				{
					label: 'Submit',
					variant: 'solid',
					onClick: (close) => submitReview(close),
				},
			],
		}"
	>
		<template #body-content>
			<div class="flex flex-col gap-4">
				<div>
					<div class="mb-1.5 text-sm text-ink-gray-5">
						{{ __('Rating') }}
					</div>
					<Rating v-model="review.rating" />
				</div>
				<div>
					<div class="mb-1.5 text-sm text-ink-gray-5">
						{{ __('Review') }}
					</div>
					<Textarea type="text" size="md" rows="5" v-model="review.review" />
				</div>
			</div>
		</template>
	</Dialog>
</template>
<script setup>
import { Dialog, Textarea, createResource, toast } from 'frappe-ui'
import { reactive } from 'vue'
import Rating from '@/components/Controls/Rating.vue'

const show = defineModel()
const reviews = defineModel('reloadReviews')
const hasReviewed = defineModel('hasReviewed')

let review = reactive({
	review: '',
	rating: 0,
})

const props = defineProps({
	courseName: {
		type: String,
		required: true,
	},
})

const createReview = createResource({
	url: 'frappe.client.insert',
	makeParams(values) {
		return {
			doc: {
				doctype: 'LMS Course Review',
				course: props.courseName,
				...values,
			},
		}
	},
})
function submitReview(close) {
	review.rating = review.rating / 5
	createReview.submit(review, {
		validate() {
			if (!review.rating) {
				return 'Please enter a rating.'
			}
		},
		onSuccess() {
			reviews.value.reload()
			hasReviewed.value.reload()
		},
		onError(err) {
			toast.error(err.messages?.[0] || err)
		},
	})
	close()
}
</script>
