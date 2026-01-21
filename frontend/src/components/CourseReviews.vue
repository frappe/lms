<template>
	<div v-if="reviews.data?.length || membership" class="mb-10">
		<div class="mb-10">
			<h2 class="text-xl font-semibold text-ink-gray-9 mb-6">
				{{ __('Course Rating') }}
			</h2>
			<div class="flex flex-col md:flex-row gap-8">
				<div
					class="flex-shrink-0 border rounded-lg p-6 text-center min-w-[160px]"
				>
					<div class="text-5xl font-bold text-ink-gray-9">
						{{ ratingBreakdownResource.data?.avg_rating || '0.0' }}
					</div>
					<div class="flex justify-center mt-2 space-x-0.5">
						<Star
							v-for="i in 5"
							:key="i"
							class="h-4 w-4"
							:class="
								i <= Math.round(ratingBreakdownResource.data?.avg_rating || 0)
									? 'fill-warning-500 text-warning-500'
									: 'fill-warning-500/50 text-warning-500'
							"
						/>
					</div>
					<div class="text-xs text-left font-medium text-gray-900 mt-2">
						{{ __('Course Rating') }}
					</div>
					<div class="text-[10px] text-left text-ink-gray-5">
						({{ ratingBreakdownResource.data?.total_reviews || 0 }} reviews)
					</div>
				</div>

				<div class="flex-1 space-y-3">
					<div
						v-for="rating in ratingBreakdownResource.data?.breakdown"
						:key="rating.stars"
						class="flex items-center gap-3"
					>
						<div class="flex items-center space-x-0.5 flex-shrink-0">
							<Star
								v-for="i in rating.stars"
								:key="i"
								class="h-3.5 w-3.5 fill-warning-500 text-warning-500"
							/>
							<Star
								v-for="i in 5 - rating.stars"
								:key="'empty-' + i"
								class="h-3.5 w-3.5 fill-gray-200 text-gray-200"
							/>
						</div>
						<span class="text-sm text-ink-gray-7 w-24 flex-shrink"
							>{{ rating.stars }} Star Rating</span
						>
						<div class="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
							<div
								class="h-full rounded-full transition-all bg-warning-500"
								:style="{ width: rating.percentage + '%' }"
							></div>
						</div>
					</div>
				</div>
			</div>
		</div>
		<div>
			<div class="flex items-center justify-between mb-6">
				<h2 class="text-xl font-semibold text-ink-gray-9">
					{{ __('Students Review') }}
				</h2>
				<Button
					v-if="membership && !hasReviewed.data"
					@click="openReviewModal()"
					class="float-right"
				>
					{{ __('Write a Review') }}
				</Button>
			</div>
			<div class="space-y-6">
				<div
					v-for="review in reviews.data"
					:key="review.id"
					class="pb-6 border-b last:border-b-0"
				>
					<div class="flex items-start gap-3">
						<router-link
							:to="{
								name: 'Profile',
								params: { username: review.owner_details.username },
							}"
						>
							<UserAvatar :user="review.owner_details" :size="'2xl'" />
						</router-link>

						<div class="flex-1">
							<div class="flex items-center gap-2 mb-1">
								<router-link
									:to="{
										name: 'Profile',
										params: { username: review.owner_details.username },
									}"
								>
									<span class="font-medium text-sm text-ink-gray-9">
										{{ review.owner_details.full_name }}
									</span>
								</router-link>
								<span class="text-ink-gray-5">•</span>
								<span class="text-xs text-ink-gray-5">{{
									review.creation
								}}</span>
							</div>
							<div class="flex space-x-0.5 mb-3">
								<Star
									v-for="index in 5"
									class="size-3.5 text-transparent rounded-sm"
									:class="
										index <= Math.ceil(review.rating)
											? 'fill-warning-500'
											: 'fill-gray-300'
									"
								/>
							</div>
							<p
								v-if="review.review"
								class="text-sm text-ink-gray-7 leading-relaxed"
							>
								{{ review.review }}
							</p>
						</div>
					</div>
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
import { createResource } from 'frappe-ui'
import { watch, ref, inject } from 'vue'
import UserAvatar from '@/components/UserAvatar.vue'
import ReviewModal from '@/components/Modals/ReviewModal.vue'
import Button from '@/components/ui/Button.vue'

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
	makeParams() {
		return {
			course: props.courseName,
		}
	},
	auto: true,
})

watch(
	() => props.courseName,
	() => {
		reviews.reload()
		ratingBreakdownResource.reload()
	},
)

watch(
	() => reviews.data,
	() => {
		ratingBreakdownResource.reload()
	},
)

const ratingBreakdownResource = createResource({
	url: 'lms.lms.api.get_rating_breakdown',
	cache: ['rating_breakdown', props.courseName],
	makeParams() {
		return {
			course: props.courseName,
		}
	},
	auto: true,
})

const showReviewModal = ref(false)

function openReviewModal() {
	showReviewModal.value = true
}
</script>
