<template>
	<section
		v-if="
			canReadReviews && (reviews.data?.length || membership || isReviewsPending)
		"
		class="space-y-6"
	>
		<div class="flex items-center justify-between gap-3">
			<h2 class="text-3xl-semibold text-ink-gray-9">
				{{ __('Reviews') }}
			</h2>
			<Button
				v-if="membership && !ownReview && canCreateReview"
				iconLeft="lucide-star"
				data-testid="write-review"
				@click="showReviewModal = true"
			>
				{{ __('Write a Review') }}
			</Button>
		</div>

		<CourseReviewsSkeleton
			v-if="isReviewsPending"
			data-testid="reviews-skeleton"
		/>
		<CourseReviewSummary
			v-else-if="ratings.length"
			v-model:stars="starFilter"
			:ratings="ratings"
		/>

		<div
			v-if="starFilter"
			class="flex items-center gap-2 text-p-base text-ink-gray-7"
		>
			{{
				starFilter === 1
					? __('Showing 1-star reviews')
					: __('Showing {0}-star reviews').format(starFilter)
			}}
			<Button variant="ghost" size="sm" @click="starFilter = null">
				{{ __('Clear') }}
			</Button>
		</div>

		<div
			v-if="visibleReviews.length"
			class="grid grid-cols-1 gap-4 @2xl:grid-cols-2"
		>
			<article
				v-for="review in visibleReviews"
				:key="review.name"
				class="group relative flex flex-col gap-2.5 rounded-6 border border-outline-gray-2 p-4"
			>
				<Button
					v-if="review.name === ownReview?.name"
					icon="lucide-pencil"
					variant="ghost"
					size="sm"
					:label="__('Edit your review')"
					:tooltip="__('Edit your review')"
					class="absolute end-2 top-2 opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
					data-testid="edit-review"
					@click="showReviewModal = true"
				/>
				<ReviewStars :rating="review.rating" />
				<div v-if="review.review" class="flex-1">
					<p
						class="text-p-base leading-6 text-ink-gray-8"
						:class="{ 'line-clamp-5': !expanded[review.name] }"
					>
						{{ review.review }}
					</p>
					<button
						v-if="isClampable(review.review)"
						type="button"
						class="mt-1 text-p-sm-medium text-ink-gray-9 hover:underline"
						@click="toggleExpand(review.name)"
					>
						{{ expanded[review.name] ? __('See less') : __('See more') }}
					</button>
				</div>
				<div class="mt-auto flex items-center gap-2">
					<router-link
						:to="{
							name: 'Profile',
							params: { username: review.owner_details.username },
						}"
						class="flex min-w-0 items-center gap-2"
					>
						<UserAvatar :user="review.owner_details" size="sm" />
						<span class="truncate text-p-base text-ink-gray-8">
							{{ review.owner_details.full_name }}
						</span>
					</router-link>
					<span class="ms-auto shrink-0 text-p-sm text-ink-gray-6">
						{{ formatReviewDate(review.creation) }}
					</span>
				</div>
			</article>
		</div>

		<Button v-if="canShowMore" class="w-full" size="md" @click="showAll = true">
			{{ __('View all reviews') }}
		</Button>
	</section>
	<ReviewModal
		v-model="showReviewModal"
		:courseName="courseName"
		:ownReview="ownReview"
		@saved="onSaved"
	/>
</template>

<script setup lang="ts">
import { createResource, Button } from 'frappe-ui'
import CourseReviewsSkeleton from '@/components/Skeletons/CourseReviewsSkeleton.vue'
import { computed, inject, reactive, ref, watch } from 'vue'
import CourseReviewSummary from '@/components/CourseReviewSummary.vue'
import ReviewStars from '@/components/ReviewStars.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import { starBucket } from '@/utils/reviews'
import { hasDoctypePermission, hasLmsRole } from '@/utils/doctypePermissions'
import ReviewModal from '@/components/Modals/ReviewModal.vue'
import type dayjsType from 'dayjs'
import type {
	CourseReviewInfo,
	Membership,
	OwnCourseReview,
	Resource,
	SessionUser,
} from '@/types'

const user = inject<SessionUser>('$user')!
const dayjs = inject<typeof dayjsType>('$dayjs')!

const PREVIEW_LIMIT = 4
const CLAMP_THRESHOLD = 220

const props = defineProps<{
	courseName: string
	membership?: Membership | null
}>()

// Guests, and anyone without an LMS role, get the public list get_reviews serves
// when the site allows guest access. An LMS role is gated on its LMS Course
// Review DocPerms, so a site can turn reviews off for students.
const canReadReviews = computed(
	() => !hasLmsRole(user) || hasDoctypePermission(user, 'LMS Course Review')
)
const canCreateReview = computed(() =>
	hasDoctypePermission(user, 'LMS Course Review', 'create')
)

// Only the signed-in member's own row comes back: students read and write
// reviews `if_owner`.
const ownReviewResource = createResource({
	url: 'frappe.client.get_list',
	cache: ['own_course_review', props.courseName, props.membership?.member],
	params: {
		doctype: 'LMS Course Review',
		filters: { course: props.courseName, owner: props.membership?.member },
		fields: ['name', 'rating', 'review'],
		limit_page_length: 1,
	},
	auto: Boolean(props.membership?.member && canReadReviews.value),
}) as Resource<OwnCourseReview[] | null>

const ownReview = computed<OwnCourseReview | null>(
	() => ownReviewResource.data?.[0] || null
)

const reviews = createResource({
	url: 'lms.lms.utils.get_reviews',
	cache: ['course_reviews', props.courseName],
	makeParams() {
		return { course: props.courseName }
	},
	auto: Boolean(props.courseName && canReadReviews.value),
}) as Resource<CourseReviewInfo[] | null>

const isReviewsPending = computed(() => reviews.loading && !reviews.data)

watch(
	() => props.courseName,
	() => {
		if (props.courseName && canReadReviews.value) reviews.reload()
	}
)

const showReviewModal = ref(false)
const showAll = ref(false)
const starFilter = ref<number | null>(null)
const expanded = reactive<Record<string, boolean>>({})

const matchingReviews = computed(() => {
	// Drop reviews whose author record is missing: owner_details can come
	// back null for guest-authored or deleted-user reviews, and the row
	// markup dereferences it for the avatar / profile link.
	const all = (reviews.data || []).filter((r) => r.owner_details)
	const own = all.filter((r) => r.name === ownReview.value?.name)
	return [...own, ...all.filter((r) => !own.includes(r))].filter(
		(r) => !starFilter.value || starBucket(r.rating) === starFilter.value
	)
})

const visibleReviews = computed(() =>
	showAll.value
		? matchingReviews.value
		: matchingReviews.value.slice(0, PREVIEW_LIMIT)
)

const ratings = computed(() => (reviews.data || []).map((r) => r.rating))

const canShowMore = computed(
	() => !showAll.value && matchingReviews.value.length > PREVIEW_LIMIT
)

function isClampable(text: string) {
	return text.length > CLAMP_THRESHOLD
}

function toggleExpand(name: string) {
	expanded[name] = !expanded[name]
}

function formatReviewDate(date: string) {
	if (!date) return ''
	const d = dayjs(date)
	const months = dayjs().diff(d, 'month')
	if (months >= 1) {
		return months === 1
			? __('1 month ago')
			: __('{0} months ago').format(months)
	}
	const days = dayjs().diff(d, 'day')
	if (days >= 1) {
		return days === 1 ? __('1 day ago') : __('{0} days ago').format(days)
	}
	return __('Today')
}

function onSaved() {
	reviews.reload()
	ownReviewResource.reload()
}
</script>
