<template>
	<div class="flex flex-1 flex-col">
		<div class="mt-10 space-y-10">
			<div v-if="evals?.data?.length">
				<div class="text-lg-semibold text-ink-gray-9 mb-3">
					{{ __('Upcoming Evaluations') }}
				</div>
				<div class="grid grid-cols-1 @2xl:grid-cols-4 gap-5">
					<component
						:is="user.data?.username ? 'router-link' : 'div'"
						v-for="evaluation in evals?.data"
						:key="evaluation.name"
						:to="profileRoute(user.data?.username, 'ProfileEvaluationSchedule')"
						class="border rounded-5 p-3 flex flex-col h-full"
						:class="
							user.data?.username
								? 'cursor-pointer hover:border-outline-gray-3'
								: ''
						"
					>
						<div class="text-ink-gray-9 text-lg-semibold leading-5 mb-3">
							{{ evaluation.course_title }}
						</div>
						<div class="text-ink-gray-7">
							<div class="flex items-center mb-3">
								<span class="lucide-calendar size-4" />
								<span class="ms-2">
									{{ dayjs(evaluation.date).format('DD MMMM YYYY') }}
								</span>
							</div>
							<div class="flex items-center mb-3">
								<span class="lucide-clock size-4" />
								<span class="ms-2">
									{{ formatTime(evaluation.start_time) }}
								</span>
							</div>
							<div v-if="evaluation.timezone" class="flex items-center mb-3">
								<span class="lucide-globe size-4" />
								<span class="ms-2">
									{{ formatTimezone(evaluation.timezone, evaluation.date) }}
								</span>
							</div>
							<div class="flex items-center">
								<span class="lucide-graduation-cap size-4" />
								<span class="ms-2">
									{{ evaluation.member_name }}
								</span>
							</div>
						</div>
					</component>
				</div>
			</div>
			<div v-if="liveClasses?.data?.length">
				<div class="text-lg-semibold text-ink-gray-9 mb-3">
					{{ __('Upcoming Live Classes') }}
				</div>
				<div class="grid grid-cols-1 @2xl:grid-cols-4 gap-5">
					<div
						v-for="cls in liveClasses?.data"
						:key="cls.name"
						class="border hover:border-outline-gray-3 rounded-5 p-3"
					>
						<div class="text-ink-gray-9 text-lg-semibold leading-5 mb-1">
							{{ cls.title }}
						</div>
						<div class="text-ink-gray-7 leading-5 mb-4">
							{{ cls.description }}
						</div>
						<LiveClassCard
							:cls="cls"
							class="space-y-3"
							ended-class="text-ink-amber-5"
						/>
					</div>
				</div>
			</div>
		</div>

		<HomeSectionSkeleton
			v-if="isPending(createdCourses)"
			kind="courses"
			class="mt-10"
			data-testid="courses-skeleton"
		/>
		<div v-else-if="createdCourses.data?.length" class="mt-10">
			<div class="flex items-center justify-between mb-3">
				<span class="text-lg-semibold text-ink-gray-9">
					{{ __('Courses Created') }}
				</span>
				<router-link
					:to="{
						name: 'Courses',
					}"
				>
					<span class="flex items-center gap-x-1 text-ink-gray-6 text-xs">
						<span>
							{{ __('See all') }}
						</span>
						<span class="lucide-move-right size-3 rtl:rotate-180" />
					</span>
				</router-link>
			</div>
			<div class="grid grid-cols-1 @lg:grid-cols-2 @4xl:grid-cols-3 gap-5">
				<CourseCard
					v-for="course in createdCourses.data"
					:key="course.name"
					:course="course"
					:to="{ name: 'CourseDetail', params: { courseName: course.name } }"
				/>
			</div>
		</div>

		<HomeSectionSkeleton
			v-if="isPending(createdBatches)"
			kind="batches"
			class="mt-10"
			data-testid="batches-skeleton"
		/>
		<div v-else-if="createdBatches.data?.length" class="mt-10">
			<div class="flex items-center justify-between mb-3">
				<span class="text-lg-semibold text-ink-gray-9">
					{{ __('Upcoming Batches') }}
				</span>
				<router-link
					:to="{
						name: 'Batches',
					}"
				>
					<span class="flex items-center gap-x-1 text-ink-gray-6 text-xs">
						<span>
							{{ __('See all') }}
						</span>
						<span class="lucide-move-right size-3 rtl:rotate-180" />
					</span>
				</router-link>
			</div>
			<div class="grid grid-cols-1 @lg:grid-cols-2 @4xl:grid-cols-4 gap-5">
				<BatchCard
					v-for="batch in createdBatches.data"
					:key="batch.name"
					:batch="batch"
					:to="{ name: 'BatchDetail', params: { batchName: batch.name } }"
				/>
			</div>
		</div>

		<EmptyStateLayout
			v-if="
				createdCourses.data &&
				createdBatches.data &&
				!createdCourses.data.length &&
				!createdBatches.data.length
			"
			name="Courses"
			:title="__('No courses created')"
			:description="
				__(
					'There are no courses currently. Create your first course to get started!'
				)
			"
		>
			<Button
				:route="{ name: 'NewCourse' }"
				@click="setFormSource('admin_home')"
			>
				<template #prefix>
					<span class="lucide-plus size-4" />
				</template>
				{{ __('New Course') }}
			</Button>
		</EmptyStateLayout>
	</div>
</template>
<script setup lang="ts">
import { Button, createResource } from 'frappe-ui'
import { inject, watch } from 'vue'
import { formatTime } from '@/utils'
import { formatTimezone } from '@/utils/timezone'
import { profileRoute } from '@/utils/routes'
import CourseCard from '@/components/CourseCard.vue'
import EmptyStateLayout from '@/components/Layouts/EmptyStateLayout.vue'
import { setFormSource } from '@/composables/formTracking'
import BatchCard from '@/pages/Batches/components/BatchCard.vue'
import LiveClassCard from '@/pages/Home/LiveClassCard.vue'
import HomeSectionSkeleton from '@/components/Skeletons/HomeSectionSkeleton.vue'
import { isPending } from '@/pages/Home/pending'

const user = inject<any>('$user')
const dayjs = inject<any>('$dayjs')

const props = defineProps<{
	liveClasses?: { data?: any[] | null; error?: unknown }
	evals?: { data?: any[] | null; error?: unknown }
}>()

const emit = defineEmits<{ pending: [boolean] }>()

const createdCourses = createResource({
	url: 'lms.lms.api.get_created_courses',
	auto: true,
})

const createdBatches = createResource({
	url: 'lms.lms.api.get_created_batches',
	auto: true,
})

watch(
	() => isPending(createdCourses) || isPending(createdBatches),
	(pending) => emit('pending', pending),
	{ immediate: true }
)
</script>
