<template>
	<Dialog
		v-model="show"
		:options="{
			title: __('Student Progress'),
			size: hasAssessmentData ? '3xl' : 'xl',
		}"
	>
		<template #body-content>
			<div class="text-base text-ink-gray-9 max-h-[70vh] overflow-y-auto">
				<div class="flex justify-between mb-5 px-2">
					<div class="flex items-center space-x-2">
						<Avatar
							:image="student?.member_image"
							:label="student?.member_name"
							size="xl"
						/>
						<div>
							<div class="font-semibold">
								{{ student?.member_name }}
							</div>
							<div class="text-ink-gray-5">
								{{ student.member }}
							</div>
						</div>
					</div>
					<div class="w-25 space-y-2">
						<div class="text-ink-gray-5 text-sm">
							{{ Math.round(student.progress) }}% {{ __('completed') }}
						</div>
						<ProgressBar
							:label="__('Course Progress')"
							:progress="student.progress"
						/>
					</div>
				</div>

				<div class="grid gap-5" :class="hasAssessmentData ? 'grid-cols-2' : ''">
					<div
						v-if="lessons.data"
						class="border border-outline-gray-modals rounded-lg px-3 pt-3 max-h-[60vh] overflow-y-auto"
					>
						<div>
							<div class="text-ink-gray-5 mb-5">
								{{ __('Lesson Progress') }}
							</div>
						</div>
						<div
							v-for="progress in lessons.data"
							class="flex justify-between text-sm py-2 my-1"
						>
							<div class="">
								<span class="mr-3 text-xs">
									{{ progress.chapter_idx }}.{{ progress.idx }}
								</span>
								<span>
									{{ progress.title }}
								</span>
							</div>
							<Tooltip
								v-if="getLessonStatus(progress) == 'Complete'"
								:text="__('Complete')"
							>
								<Check class="text-ink-green-3 size-4" />
							</Tooltip>
							<Tooltip v-else :text="__('Pending')">
								<Minus class="text-ink-amber-2 size-4" />
							</Tooltip>
							<!-- <Badge :theme="getLessonStatusTheme(progress)">
								{{ getLessonStatus(progress) }}
							</Badge> -->
						</div>
					</div>

					<div class="space-y-3">
						<div
							v-if="assessmentProgress.data?.quizzes?.length"
							class="border border-outline-gray-modals rounded-lg px-3 pt-3 h-fit"
						>
							<div>
								<div class="text-ink-gray-5 mb-5">
									{{ __('Quiz Progress') }}
								</div>
							</div>
							<div
								v-for="quiz in assessmentProgress.data.quizzes"
								class="flex justify-between text-sm py-2 my-1"
							>
								<div>
									{{ quiz.quiz_title }}
								</div>
								<div>
									{{ quiz.score }}
								</div>
								<div>{{ quiz.percentage }}%</div>
							</div>
						</div>

						<div
							v-if="assessmentProgress.data?.assignments?.length"
							class="border border-outline-gray-modals rounded-lg px-3 pt-3 h-fit"
						>
							<div>
								<div class="text-ink-gray-5 mb-5">
									{{ __('Assignment Progress') }}
								</div>
							</div>
							<div
								v-for="assignment in assessmentProgress.data.assignments"
								class="flex justify-between text-sm py-2 my-1"
							>
								<div>
									{{ assignment.assignment_title }}
								</div>
								<Badge :theme="getAssessmentStatusTheme(assignment.status)">
									{{ assignment.status }}
								</Badge>
							</div>
						</div>

						<div
							v-if="assessmentProgress.data?.exercises?.length"
							class="border border-outline-gray-modals rounded-lg px-3 pt-3 h-fit"
						>
							<div>
								<div class="text-ink-gray-5 mb-5">
									{{ __('Programming Exercise Progress') }}
								</div>
							</div>
							<div
								v-for="exercise in assessmentProgress.data.exercises"
								class="flex justify-between text-sm py-2 my-1"
							>
								<div>
									{{ exercise.exercise_title }}
								</div>
								<Badge :theme="getAssessmentStatusTheme(exercise.status)">
									{{ exercise.status }}
								</Badge>
							</div>
						</div>
					</div>
				</div>
			</div>
		</template>
	</Dialog>
</template>
<script setup lang="ts">
import {
	Avatar,
	Badge,
	createListResource,
	createResource,
	Dialog,
	Tooltip,
} from 'frappe-ui'
import ProgressBar from '@/components/ProgressBar.vue'
import { computed } from 'vue'
import { Check, Minus } from 'lucide-vue-next'

const show = defineModel<boolean>({ required: true, default: false })

const props = defineProps<{
	course: any
	student: any
	lessons: any
}>()

const lessonProgress = createListResource({
	doctype: 'LMS Course Progress',
	filters: {
		course: ['=', props.course.data?.name],
		member: ['=', props.student?.member],
	},
	fields: ['name', 'lesson', 'status'],
	auto: true,
})

const assessmentProgress = createResource({
	url: 'lms.lms.api.get_course_assessment_progress',
	params: {
		course: props.course.data?.name,
		member: props.student?.member,
	},
	auto: true,
})

const getLessonStatus = (lesson: any) => {
	return (
		lessonProgress.data?.find((lp: any) => lp.lesson === lesson.lesson)
			?.status || __('Pending')
	)
}

const getLessonStatusTheme = (lesson: any) => {
	const status = getLessonStatus(lesson)
	if (status === 'Complete') {
		return 'green'
	} else {
		return 'orange'
	}
}

const getAssessmentStatusTheme = (status: string) => {
	if (status.includes('Pass')) return 'green'
	else if (status.includes('Fail')) return 'red'
	else return 'orange'
}

const hasAssessmentData = computed(() => {
	return (
		(assessmentProgress.data?.quizzes &&
			assessmentProgress.data.quizzes.length > 0) ||
		(assessmentProgress.data?.assignments &&
			assessmentProgress.data.assignments.length > 0) ||
		(assessmentProgress.data?.exercises &&
			assessmentProgress.data.exercises.length > 0)
	)
})
</script>
