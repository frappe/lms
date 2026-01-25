<template>
	<Dialog
		v-model="show"
		:options="{
			title: __('Write a Review'),
			size: 'xl',
		}"
	>
		<template #body-content>
			<div class="flex flex-col gap-4">
				<div
					class="[&_.\!fill-yellow-500]:!fill-warning-500 [&_.\!fill-yellow-200]:!fill-warning-200"
				>
					<Rating v-model="review.rating" :label="__('Rating')" />
				</div>

				<FormControl
					:label="__('Review')"
					type="textarea"
					v-model="review.review"
					:rows="5"
				/>
			</div>
		</template>
		<template #actions="{ close }">
			<div class="flex justify-start flex-row-reverse gap-2">
				<Button class="w-full" variant="solid" @click="submitReview(close)">
					Submit
				</Button>
			</div>
		</template>
	</Dialog>
</template>
<script setup>
import { Dialog, FormControl, createResource, toast, Rating } from 'frappe-ui'
import { reactive } from 'vue'

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
