<template>
	<div v-if="!forHome || (forHome && upcoming_evals.data?.length)">
		<div class="flex items-center justify-between mb-4">
			<div class="text-lg text-ink-gray-9 font-semibold">
				{{ __('Upcoming Evaluations') }}
			</div>
			<Button v-if="canScheduleEvals" @click="openEvalModal">
				{{ __('Schedule') }}
			</Button>
		</div>
		<div
			v-if="endDate && !endDateHasPassed"
			class="text-sm leading-5 bg-surface-amber-1 text-ink-amber-3 p-2 rounded-md mb-4"
		>
			{{ __('The last day to schedule your evaluations is ') }}
			<span class="font-medium">
				{{ dayjs(endDate).format('DD MMMM YYYY') }} </span
			>.
			{{ __('Please make sure to schedule your evaluation before this date.') }}
		</div>
		<div
			v-else-if="endDateHasPassed"
			class="text-sm leading-5 bg-surface-red-1 text-ink-red-3 p-2 rounded-md mb-4"
		>
			{{
				__(
					'The deadline to schedule evaluations has passed. Please contact the Instructor for assistance.'
				)
			}}
		</div>
		<div v-if="upcoming_evals.data?.length">
			<div
				class="grid gap-4"
				:class="forHome ? 'grid-cols-1 md:grid-cols-4' : 'grid-cols-1'"
			>
				<div v-for="evl in upcoming_evals.data">
					<div
						class="border hover:border-outline-gray-3 text-ink-gray-7 rounded-md p-3"
					>
						<div class="flex justify-between mb-3">
							<span class="font-semibold text-ink-gray-9 leading-5">
								{{ evl.course_title }}
							</span>
							<Dropdown
								v-if="evl.date > dayjs().format()"
								:options="[
									{
										label: __('Cancel'),
										icon: Ban,
										onClick() {
											cancelEvaluation(evl)
										},
									},
								]"
								placement="left"
								side="left"
							>
								<template v-slot="{ open }">
									<Button variant="ghost">
										<template #icon>
											<EllipsisVertical class="w-4 h-4 stroke-1.5" />
										</template>
									</Button>
								</template>
							</Dropdown>
						</div>
						<div class="flex items-center mb-3">
							<Calendar class="w-4 h-4 stroke-1.5" />
							<span class="ml-2">
								{{ dayjs(evl.date).format('DD MMMM YYYY') }}
							</span>
						</div>
						<div class="flex items-center mb-3">
							<Clock class="w-4 h-4 stroke-1.5" />
							<span class="ml-2">
								{{ formatTime(evl.start_time) }}
							</span>
						</div>
						<div class="flex items-center">
							<GraduationCap class="w-4 h-4 stroke-1.5" />
							<span class="ml-2">
								{{ evl.evaluator_name }}
							</span>
						</div>
						<div
							v-if="evl.google_meet_link"
							class="flex items-center justify-between space-x-2 mt-4"
						>
							<Button @click="openEvalCall(evl)" class="w-full">
								<template #prefix>
									<HeadsetIcon class="w-4 h-4 stroke-1.5" />
								</template>
								{{ __('Join Call') }}
							</Button>
						</div>
					</div>
				</div>
			</div>
		</div>
		<div v-else-if="!endDateHasPassed" class="text-ink-gray-7">
			{{ __('Schedule an evaluation to get certified.') }}
		</div>
	</div>
	<EvaluationModal
		:batch="batch"
		:endDate="endDate"
		:courses="courses"
		v-model="showEvalModal"
		v-model:reloadEvals="upcoming_evals"
	/>
</template>
<script setup>
import {
	Ban,
	Calendar,
	Clock,
	GraduationCap,
	HeadsetIcon,
	EllipsisVertical,
} from 'lucide-vue-next'
import { inject, ref, getCurrentInstance, computed } from 'vue'
import { formatTime } from '@/utils'
import { Button, createListResource, call, Dropdown, toast } from 'frappe-ui'
import EvaluationModal from '@/components/Modals/EvaluationModal.vue'

const dayjs = inject('$dayjs')
const user = inject('$user')
const showEvalModal = ref(false)
const app = getCurrentInstance()
const { $dialog } = app.appContext.config.globalProperties

const props = defineProps({
	batch: {
		type: String,
		default: null,
	},
	courses: {
		type: Array,
		default: [],
	},
	endDate: {
		type: String,
		default: null,
	},
	forHome: {
		type: Boolean,
		default: false,
	},
})

const upcoming_evals = createListResource({
	doctype: 'LMS Certificate Request',
	filters: {
		course: props.courses?.length
			? ['in', props.courses.map((course) => course.course)]
			: undefined,
		batch_name: props.batch || undefined,
		status: 'Upcoming',
		member: user?.data?.name,
		date: ['>=', dayjs().format('YYYY-MM-DD')],
	},
	fields: [
		'name',
		'date',
		'start_time',
		'evaluator_name',
		'course_title',
		'member',
		'member_name',
		'google_meet_link',
	],
	orderBy: 'date',
	auto: true,
})

function openEvalModal() {
	showEvalModal.value = true
}

const openEvalCall = (evl) => {
	window.open(evl.google_meet_link, '_blank')
}

const evaluationCourses = computed(() => {
	return props.courses.filter((course) => {
		return course.evaluator && course.evaluator != ''
	})
})

const canScheduleEvals = computed(() => {
	return (
		upcoming_evals.data?.length != evaluationCourses.value?.length &&
		!props.forHome &&
		!endDateHasPassed.value
	)
})

const endDateHasPassed = computed(() => {
	return dayjs().isSameOrAfter(dayjs(props.endDate))
})

const cancelEvaluation = (evl) => {
	$dialog({
		title: __('Confirm Cancellation?'),
		message: __(
			'Are you sure you want to cancel this evaluation? This action cannot be undone.'
		),
		actions: [
			{
				label: __('Cancel'),
				theme: 'red',
				variant: 'solid',
				onClick(close) {
					call('lms.lms.api.cancel_evaluation', { evaluation: evl })
						.then(() => {
							upcoming_evals.reload()
							toast.success(__('Evaluation cancelled successfully'))
						})
						.catch((err) => {
							toast.error(__(err.messages?.[0] || err))
							console.error(err)
						})
					close()
				},
			},
		],
	})
}
</script>
