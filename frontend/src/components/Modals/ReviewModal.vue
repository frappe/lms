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
				<Rating v-model="review.rating" :label="__('Rating')" />
				<FormControl
					:label="__('Review')"
					type="textarea"
					v-model="review.review"
					:rows="5"
				/>
			</div>
		</template>
	</Dialog>
</template>
<script setup lang="ts">
import { Dialog, FormControl, createResource, toast, Rating } from 'frappe-ui'
import { reactive } from 'vue'
import type { Resource } from '@/types/api'

const show = defineModel<boolean>()
const reviews = defineModel<Resource<unknown> | undefined>('reloadReviews')
const hasReviewed = defineModel<Resource<unknown> | undefined>('hasReviewed')

const review = reactive<{ review: string; rating: number }>({
	review: '',
	rating: 0,
})

const props = defineProps<{
	courseName: string
}>()

const createReview = createResource({
	url: 'frappe.client.insert',
	makeParams() {
		return {
			doc: {
				doctype: 'LMS Course Review',
				course: props.courseName,
				...review,
			},
		}
	},
})

function submitReview(close: () => void) {
	review.rating = review.rating / 5
	createReview.submit(review, {
		validate() {
			if (!review.rating) {
				return 'Please enter a rating.'
			}
		},
		onSuccess() {
			reviews.value?.reload()
			hasReviewed.value?.reload()
		},
		onError(err: { messages?: string[] } | string) {
			const msg = typeof err === 'string' ? err : err.messages?.[0] ?? 'Error'
			toast.error(msg)
		},
	})
	close()
}
</script>
