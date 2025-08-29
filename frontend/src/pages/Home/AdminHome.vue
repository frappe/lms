<template>
	<div>
		<div v-if="createdCourses.data?.length" class="mt-10">
			<div class="flex items-center justify-between mb-3">
				<span class="font-semibold text-lg">
					{{ __('Courses Created') }}
				</span>
				<router-link
					:to="{
						name: 'Courses',
					}"
				>
					<span class="flex items-center space-x-1 text-ink-gray-5 text-xs">
						<span>
							{{ __('See all') }}
						</span>
						<MoveRight class="size-3 stroke-1.5" />
					</span>
				</router-link>
			</div>
			<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
				<router-link
					v-for="course in createdCourses.data"
					:to="{ name: 'CourseDetail', params: { courseName: course.name } }"
				>
					<CourseCard :course="course" />
				</router-link>
			</div>
		</div>

		<div v-if="createdBatches.data?.length" class="mt-10">
			<div class="flex items-center justify-between mb-3">
				<span class="font-semibold text-lg">
					{{ __('Upcoming Batches') }}
				</span>
				<router-link
					:to="{
						name: 'Batches',
					}"
				>
					<span class="flex items-center space-x-1 text-ink-gray-5 text-xs">
						<span>
							{{ __('See all') }}
						</span>
						<MoveRight class="size-3 stroke-1.5" />
					</span>
				</router-link>
			</div>
			<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
				<router-link
					v-for="batch in createdBatches.data"
					:to="{ name: 'BatchDetail', params: { batchName: batch.name } }"
				>
					<BatchCard :batch="batch" />
				</router-link>
			</div>
		</div>

		<div
			v-if="!createdCourses.data?.length && !createdBatches.data?.length"
			class="flex flex-col items-center justify-center mt-60"
		>
			<GraduationCap class="size-10 mx-auto stroke-1 text-ink-gray-5" />
			<div class="text-lg font-semibold text-ink-gray-7 mb-1.5">
				{{ __('No courses created') }}
			</div>
			<div
				class="leading-5 text-base w-full md:w-2/5 text-base text-center text-ink-gray-7"
			>
				{{
					__(
						'There are no courses currently. Create your first course to get started!'
					)
				}}
			</div>
			<router-link
				:to="{ name: 'CourseForm', params: { courseName: 'new' } }"
				class="mt-4"
			>
				<Button>
					<template #prefix>
						<Plus class="size-4 stroke-1.5" />
					</template>
					{{ __('Create Course') }}
				</Button>
			</router-link>
		</div>

		<div class="grid grid-cols-2 gap-5 mt-10">
			<div v-if="evals?.data?.length">
				<div class="font-semibold text-lg mb-3">
					{{ __('Upcoming Evaluations') }}
				</div>
				<div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
					<div
						v-for="evaluation in evals?.data"
						class="border rounded-md p-3 flex flex-col h-full cursor-pointer"
						@click="redirectToProfile()"
					>
						<div class="font-semibold text-ink-gray-9 text-lg mb-1">
							{{ evaluation.course_title }}
						</div>
						<div class="text-ink-gray-7 text-sm">
							<div class="flex items-center mb-2">
								<Calendar class="w-4 h-4 stroke-1.5" />
								<span class="ml-2">
									{{ dayjs(evaluation.date).format('DD MMMM YYYY') }}
								</span>
							</div>
							<div class="flex items-center mb-2">
								<Clock class="w-4 h-4 stroke-1.5" />
								<span class="ml-2">
									{{ formatTime(evaluation.start_time) }}
								</span>
							</div>
							<div class="flex items-center">
								<GraduationCap class="w-4 h-4 stroke-1.5" />
								<span class="ml-2">
									{{ evaluation.member_name }}
								</span>
							</div>
						</div>
					</div>
				</div>
			</div>
			<div v-if="liveClasses?.data?.length">
				<div class="font-semibold text-lg mb-3">
					{{ __('Upcoming Live Classes') }}
				</div>
				<div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
					<div v-for="cls in liveClasses?.data" class="border rounded-md p-3">
						<div class="font-semibold text-ink-gray-9 text-lg mb-1">
							{{ cls.title }}
						</div>
						<div class="text-ink-gray-7 text-sm leading-5 mb-4">
							{{ cls.description }}
						</div>
						<div class="mt-auto space-y-3 text-ink-gray-7 text-sm">
							<div class="flex items-center space-x-2">
								<Calendar class="w-4 h-4 stroke-1.5" />
								<span>
									{{ dayjs(cls.date).format('DD MMMM YYYY') }}
								</span>
							</div>
							<div class="flex items-center space-x-2">
								<Clock class="w-4 h-4 stroke-1.5" />
								<span>
									{{ formatTime(cls.time) }} -
									{{ dayjs(getClassEnd(cls)).format('HH:mm A') }}
								</span>
							</div>
							<div
								v-if="canAccessClass(cls)"
								class="flex items-center space-x-2 text-ink-gray-9 mt-auto"
							>
								<a
									v-if="user.data?.is_moderator || user.data?.is_evaluator"
									:href="cls.start_url"
									target="_blank"
									class="cursor-pointer inline-flex items-center justify-center gap-2 transition-colors focus:outline-none text-ink-gray-8 bg-surface-gray-2 hover:bg-surface-gray-3 active:bg-surface-gray-4 focus-visible:ring focus-visible:ring-outline-gray-3 h-7 text-base px-2 rounded"
									:class="cls.join_url ? 'w-full' : 'w-1/2'"
								>
									<Monitor class="h-4 w-4 stroke-1.5" />
									{{ __('Start') }}
								</a>
								<a
									:href="cls.join_url"
									target="_blank"
									class="w-full cursor-pointer inline-flex items-center justify-center gap-2 transition-colors focus:outline-none text-ink-gray-8 bg-surface-gray-2 hover:bg-surface-gray-3 active:bg-surface-gray-4 focus-visible:ring focus-visible:ring-outline-gray-3 h-7 text-base px-2 rounded"
								>
									<Video class="h-4 w-4 stroke-1.5" />
									{{ __('Join') }}
								</a>
							</div>
							<Tooltip
								v-else-if="hasClassEnded(cls)"
								:text="__('This class has ended')"
								placement="right"
							>
								<div class="flex items-center space-x-2 text-ink-amber-3 w-fit">
									<Info class="w-4 h-4 stroke-1.5" />
									<span>
										{{ __('Ended') }}
									</span>
								</div>
							</Tooltip>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>
<script setup lang="ts">
import { Button, createResource, Tooltip } from 'frappe-ui'
import { inject } from 'vue'
import { useRouter } from 'vue-router'
import {
	Calendar,
	Clock,
	GraduationCap,
	Info,
	Monitor,
	MoveRight,
	Plus,
	Video,
} from 'lucide-vue-next'
import { formatTime } from '@/utils'
import CourseCard from '@/components/CourseCard.vue'
import BatchCard from '@/components/BatchCard.vue'

const user = inject<any>('$user')
const dayjs = inject<any>('$dayjs')
const router = useRouter()

const props = defineProps<{
	liveClasses?: { data?: any[] }
	evals?: { data?: any[] }
}>()

const createdCourses = createResource({
	url: 'lms.lms.utils.get_created_courses',
	auto: true,
})

const createdBatches = createResource({
	url: 'lms.lms.utils.get_created_batches',
	auto: true,
})

const getClassEnd = (cls: { date: string; time: string; duration: number }) => {
	const classStart = new Date(`${cls.date}T${cls.time}`)
	return new Date(classStart.getTime() + cls.duration * 60000)
}

const canAccessClass = (cls: {
	date: string
	time: string
	duration: number
}) => {
	if (cls.date < dayjs().format('YYYY-MM-DD')) return false
	if (cls.date > dayjs().format('YYYY-MM-DD')) return false
	if (hasClassEnded(cls)) return false
	return true
}

const hasClassEnded = (cls: {
	date: string
	time: string
	duration: number
}) => {
	const classEnd = getClassEnd(cls)
	const now = new Date()
	return now > classEnd
}

const redirectToProfile = () => {
	router.push({
		name: 'ProfileEvaluationSchedule',
		params: { username: user.data?.username },
	})
}
</script>
