<template>
	<div v-if="reviews.data?.length || membership" class="mt-20 mb-10">
		<Button
			v-if="membership && !hasReviewed.data"
			@click="openReviewModal()"
			class="float-right"
		>
			{{ __('Write a Review') }}
		</Button>
		<div class="flex items-center font-semibold text-2xl text-ink-gray-9">
			{{ __('Student Reviews') }}
		</div>
		<div class="grid gap-8 mt-10">
			<div v-for="(review, index) in reviews.data">
				<div class="flex items-center">
					<router-link
						:to="{
							name: 'Profile',
							params: { username: review.owner_details.username },
						}"
					>
						<UserAvatar :user="review.owner_details" :size="'2xl'" />
					</router-link>
					<div class="mx-4">
						<router-link
							:to="{
								name: 'Profile',
								params: { username: review.owner_details.username },
							}"
						>
							<span class="text-lg font-medium mr-4 text-ink-gray-7">
								{{ review.owner_details.full_name }}
							</span>
						</router-link>
						<span class="text-ink-gray-7">
							{{ review.creation }}
						</span>
						<div class="flex mt-2 space-x-1">
							<Star
								v-for="index in 5"
								class="size-4 text-transparent rounded-sm"
								:class="
									index <= Math.ceil(review.rating)
										? 'fill-yellow-500'
										: 'fill-gray-300'
								"
							/>
						</div>
					</div>
				</div>
				<div v-if="review.review" class="mt-4 leading-5 text-ink-gray-7">
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
		type: String,
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
