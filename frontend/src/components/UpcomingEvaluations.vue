<template>
	<div>
		<div class="flex items-center justify-between mb-4">
			<div class="text-lg font-semibold">
				{{ __('Upcoming Evaluations') }}
			</div>
			<Button @click="openEvalModal">
				{{ __('Schedule Evaluation') }}
			</Button>
		</div>
		<div v-if="upcoming_evals.data?.length">
			<div class="grid grid-cols-3 gap-4">
				<div v-for="evl in upcoming_evals.data">
					<div class="border rounded-md p-3">
						<div class="font-semibold mb-3">
							{{ evl.course_title }}
						</div>
						<div class="flex items-center mb-2">
							<Calendar class="w-4 h-4 stroke-1.5" />
							<span class="ml-2">
								{{ dayjs(evl.date).format('DD MMMM YYYY') }}
							</span>
						</div>
						<div class="flex items-center mb-2">
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
						<div class="flex items-center justify-between space-x-2 mt-4">
							<Button
								v-if="evl.google_meet_link"
								@click="openEvalCall(evl)"
								class="w-full"
							>
								<template #prefix>
									<HeadsetIcon class="w-4 h-4 stroke-1.5" />
								</template>
								{{ __('Join Call') }}
							</Button>
							<Button
								v-if="evl.date > dayjs().format()"
								@click="cancelEvaluation(evl)"
								class="w-full"
							>
								<template #prefix>
									<Ban class="w-4 h-4 stroke-1.5" />
								</template>
								{{ __('Cancel') }}
							</Button>
						</div>
					</div>
				</div>
			</div>
		</div>
		<div v-else class="text-sm italic text-ink-gray-5">
			{{ __('No upcoming evaluations.') }}
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
} from 'lucide-vue-next'
import { inject, ref, getCurrentInstance } from 'vue'
import { formatTime } from '../utils'
import { Button, createResource, call } from 'frappe-ui'
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
})

const upcoming_evals = createResource({
	url: 'lms.lms.utils.get_upcoming_evals',
	cache: ['upcoming_evals', user.data.name],
	params: {
		student: user.data.name,
		courses: props.courses.map((course) => course.course),
	},
	auto: true,
})

function openEvalModal() {
	showEvalModal.value = true
}

const openEvalCall = (evl) => {
	window.open(evl.google_meet_link, '_blank')
}

const cancelEvaluation = (evl) => {
	$dialog({
		title: __('Cancel this evaluation?'),
		message: __(
			'Are you sure you want to cancel this evaluation? This action cannot be undone.'
		),
		actions: [
			{
				label: __('Cancel'),
				theme: 'red',
				variant: 'solid',
				onClick(close) {
					call('lms.lms.api.cancel_evaluation', { evaluation: evl }).then(
						() => {
							upcoming_evals.reload()
						}
					)
					close()
				},
			},
		],
	})
}
</script>
