<template>
	<div v-if="reviews.data" class="mt-20 mb-10">
		<Button
			v-if="membership && !hasReviewed.data"
			@click="openReviewModal()"
			class="float-right"
		>
			{{ __('Write a Review') }}
		</Button>
		<div class="flex items-center font-semibold text-2xl">
			<Star class="h-6 w-6 stroke-1 text-gray-50 fill-orange-500 mr-1" />
			{{ avg_rating }} {{ __('ratings and ') }} {{ reviews.data.length }}
			{{ __('reviews') }}
		</div>
		<div class="grid gap-8 mt-10">
			<div v-for="(review, index) in reviews.data">
				<div class="flex items-center">
					<UserAvatar :user="review.owner_details" :size="'2xl'" />
					<div class="mx-4">
						<span class="text-lg font-medium mr-4">
							{{ review.owner_details.full_name }}
						</span>
						<span>
							{{ review.creation }}
						</span>
						<div class="flex mt-2">
							<Star
								v-for="index in 5"
								class="h-5 w-5 text-gray-100 bg-gray-200 rounded-sm mr-2"
								:class="
									index <= Math.ceil(review.rating)
										? 'fill-orange-500'
										: 'fill-gray-600'
								"
							/>
						</div>
					</div>
				</div>
				<div v-if="review.review" class="mt-4 leading-5">
					{{ review.review }}
				</div>
			</div>
		</div>
	</div>
	<ReviewModal
		v-model="showReviewModal"
		v-model:reloadReviews="reviews"
		v-model:hasReviewed="hasReviewed"
		:courseName="courseName"
	/>
</template>
<script setup>
import { Star } from 'lucide-vue-next'
import { createResource, Button } from 'frappe-ui'
import { computed, ref, inject } from 'vue'
import UserAvatar from '@/components/UserAvatar.vue'
import ReviewModal from '@/components/Modals/ReviewModal.vue'

const user = inject('$user')

const props = defineProps({
	courseName: {
		type: String,
		required: true,
	},
	avg_rating: {
		type: Number,
		required: true,
	},
	membership: {
		type: Object,
		required: false,
	},
})

const hasReviewed = createResource({
	url: 'frappe.client.get_count',
	cache: ['eligible_to_review', props.courseName, props.membership?.member],
	params: {
		doctype: 'LMS Course Review',
		filters: {
			course: props.courseName,
			owner: props.membership?.member,
		},
	},
	auto: user.data?.name ? true : false,
})

const reviews = createResource({
	url: 'lms.lms.utils.get_reviews',
	cache: ['course_reviews', props.courseName],
	params: {
		course: props.courseName,
	},
	auto: true,
})

const showReviewModal = ref(false)

function openReviewModal() {
	showReviewModal.value = true
}
</script>
