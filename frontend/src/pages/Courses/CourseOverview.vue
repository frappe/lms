<template>
	<SkeletonLoader v-if="!course.data" variant="course-page" />
	<div v-else class="p-5">
		<div
			class="flex flex-col md:flex-row items-start justify-between w-full gap-x-8 gap-y-8"
		>
			<div class="md:w-2/3 space-y-10 min-w-0">
				<section class="space-y-4">
					<h1 class="text-3xl font-semibold text-ink-gray-9">
						{{ course.data.title }}
					</h1>
					<div
						class="flex flex-wrap items-center gap-x-3 gap-y-2 text-ink-gray-7"
					>
						<template v-if="Number(course.data.rating) > 0">
							<div class="flex items-center gap-1">
								<Star class="size-4 text-yellow-500 fill-yellow-500" />
								<span class="font-medium text-ink-gray-9">{{
									formatRating(course.data.rating)
								}}</span>
								<span v-if="course.data.rating_count">
									({{ formatAmount(course.data.rating_count) }})
								</span>
							</div>
							<span class="lucide-dot size-5 text-ink-gray-7" />
						</template>
						<template v-if="course.data.enrollments">
							<div class="flex items-center gap-1.5">
								<UsersRound class="size-4 stroke-1.5" />
								<span
									>{{ formatAmount(course.data.enrollments) }}
									{{ __('Students') }}</span
								>
							</div>
							<span class="lucide-dot size-5 text-ink-gray-7" />
						</template>
						<div
							v-if="course.data.instructors?.length"
							class="flex items-center"
						>
							<span
								class="h-6 me-1"
								:class="{
									'avatar-group overlap': course.data.instructors.length > 1,
								}"
							>
								<UserAvatar
									v-for="instructor in course.data.instructors"
									:key="instructor.name"
									:user="instructor"
								/>
							</span>
							<CourseInstructors :instructors="course.data.instructors" />
						</div>
					</div>
					<div v-if="course.data.tags" class="flex flex-wrap gap-2">
						<Badge
							v-for="tag in course.data.tags.split(', ')"
							:key="tag"
							theme="gray"
							size="lg"
						>
							{{ tag }}
						</Badge>
					</div>
					<p
						v-if="course.data.short_introduction"
						class="text-ink-gray-7 leading-6"
					>
						{{ course.data.short_introduction }}
					</p>
					<div class="md:hidden">
						<CourseCardOverlay :course="course" />
					</div>
				</section>

				<section>
					<div class="flex items-baseline justify-between gap-4 mb-4">
						<h2 class="text-2xl font-semibold text-ink-gray-9">
							{{ __('Course content') }}
						</h2>
						<div class="text-base text-ink-gray-5">
							{{ outlineStats }}
						</div>
					</div>
					<div class="border rounded-md p-2">
						<SkeletonLoader
							v-if="outline.loading && !outline.data"
							variant="list"
							:count="6"
						/>
						<div
							v-else-if="!hasCourseContent"
							class="flex items-center justify-center px-4 py-10 text-center"
						>
							<span class="text-sm text-ink-gray-5">
								{{ __('Course Content coming soon!') }}
							</span>
						</div>
						<CourseOutline
							v-else
							:courseName="course.data.name"
							:getProgress="course.data.membership ? true : false"
							:editorLinks="isCourseAdmin"
						/>
					</div>
				</section>

				<section v-if="course.data.description" class="space-y-3">
					<h2 class="text-2xl font-semibold text-ink-gray-9">
						{{ __('About this course') }}
					</h2>
					<div
						v-html="course.data.description"
						class="ProseMirror prose prose-sm max-w-none !whitespace-normal prose-table:table-fixed prose-td:p-2 prose-th:p-2 prose-td:border prose-th:border prose-td:border-outline-gray-2 prose-th:border-outline-gray-2 prose-td:relative prose-th:relative prose-th:bg-surface-gray-2"
					/>
				</section>

				<CourseReviews
					:courseName="course.data.name"
					:avg_rating="course.data.rating"
					:membership="course.data.membership || null"
				/>
			</div>

			<aside
				class="hidden md:flex w-80 shrink-0 flex-col space-y-6 self-start sticky top-5"
			>
				<CourseCardOverlay :course="course" />
				<CourseCreatorCard :instructors="course.data.instructors || []" />
			</aside>
		</div>

		<RelatedCourses :courseName="course.data.name" class="mt-12" />
	</div>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import { createResource, Badge } from 'frappe-ui'
import { Star, UsersRound } from 'lucide-vue-next'
import { formatAmount, formatRating } from '@/utils/'
import type { SessionUser } from '@/types/api'
import CourseCardOverlay from '@/components/CourseCardOverlay.vue'
import CourseOutline from '@/components/CourseOutline.vue'
import SkeletonLoader from '@/components/SkeletonLoader.vue'
import CourseReviews from '@/components/CourseReviews.vue'
import CourseInstructors from '@/components/CourseInstructors.vue'
import CourseCreatorCard from '@/components/CourseCreatorCard.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import RelatedCourses from '@/components/RelatedCourses.vue'
import type { CourseDetails, OutlineChapter, Resource } from '@/types/api'

const props = defineProps<{
	course: Resource<CourseDetails | null>
}>()

const user = inject<SessionUser>('$user')

const isCourseInstructor = computed<boolean>(() =>
	(props.course.data?.instructors || []).some(
		(i) => i.name === user?.data?.name
	)
)

const isCourseAdmin = computed<boolean>(
	() => Boolean(user?.data?.is_moderator) || isCourseInstructor.value
)

const outline = createResource({
	url: 'lms.lms.utils.get_course_outline',
	cache: ['course_outline', props.course.data?.name],
	makeParams() {
		return { course: props.course.data?.name, progress: false }
	},
	auto: true,
}) as Resource<OutlineChapter[]>

const outlineStats = computed(() => {
	const chapters = outline.data || []
	const lessonCount = chapters.reduce(
		(acc, c) => acc + (c.lessons?.length || 0),
		0
	)
	const parts: string[] = []
	if (chapters.length) {
		parts.push(
			`${chapters.length} ${
				chapters.length === 1 ? __('section') : __('sections')
			}`
		)
	}
	if (lessonCount) {
		parts.push(
			`${lessonCount} ${lessonCount === 1 ? __('lesson') : __('lessons')}`
		)
	}
	return parts.join(' · ')
})

const hasCourseContent = computed(() => {
	const chapters = outline.data || []
	const lessonCount = chapters.reduce(
		(acc, c) => acc + (c.lessons?.length || 0),
		0
	)
	return chapters.length > 0 && lessonCount > 0
})
</script>
