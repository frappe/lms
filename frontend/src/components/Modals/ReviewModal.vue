<template>
	<Dialog
		v-model:open="show"
		:title="ownReview ? __('Edit your review') : __('Write a Review')"
		size="xl"
		:actions="[
			{
				label: ownReview ? __('Save') : __('Submit'),
				variant: 'solid',
				onClick: ({ close }) => submitReview(close),
			},
		]"
	>
		<template #default>
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
import type { FrappeResourceError } from 'frappe-ui'
import { resourceErrorMessage, submitResource } from '@/utils/resource'
import { reactive, watch } from 'vue'
import type { OwnCourseReview } from '@/types'

/** Writes the member's review of a course, or edits the one they wrote. */
const show = defineModel<boolean>()

const props = defineProps<{
	courseName: string
	ownReview?: OwnCourseReview | null
}>()

const emit = defineEmits<{ (e: 'saved'): void }>()

const review = reactive<{ review: string; rating: number }>({
	review: '',
	rating: 0,
})

// The Rating control is 0–5; the doctype stores a 0–1 fraction.
watch(
	show,
	(open) => {
		if (!open) return
		review.review = props.ownReview?.review || ''
		review.rating = Math.round((props.ownReview?.rating || 0) * 5)
	},
	{ immediate: true }
)

const fields = () => ({ review: review.review, rating: review.rating / 5 })

const createReview = createResource({
	url: 'frappe.client.insert',
	makeParams: () => ({
		doc: {
			doctype: 'LMS Course Review',
			course: props.courseName,
			...fields(),
		},
	}),
})

const updateReview = createResource({
	url: 'frappe.client.set_value',
	makeParams: () => ({
		doctype: 'LMS Course Review',
		name: props.ownReview?.name,
		fieldname: fields(),
	}),
})

function submitReview(close: () => void) {
	return submitResource(props.ownReview ? updateReview : createReview, review, {
		validate() {
			if (!review.rating) {
				return __('Please enter a rating.')
			}
		},
		onSuccess() {
			emit('saved')
			close()
		},
		onError(err: string | FrappeResourceError) {
			toast.error(resourceErrorMessage(err, __('Error')))
		},
	})
}
</script>
