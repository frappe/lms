<template>
	<div class="mb-10">
		<Button v-if="isStudent" @click="openEvalModal" class="float-right">
			{{ __('Schedule Evaluation') }}
		</Button>
		<div class="text-lg font-semibold mb-4">
			{{ __('Upcoming Evaluations') }}
		</div>
		<div v-if="upcoming_evals.data?.length">
			<div class="grid grid-cols-2 gap-4">
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
							<UserCog2 class="w-4 h-4 stroke-1.5" />
							<span class="ml-2 font-medium">
								{{ evl.evaluator_name }}
							</span>
						</div>
					</div>
				</div>
			</div>
		</div>
		<div v-else class="text-sm italic text-gray-600">
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
import { Calendar, Clock, UserCog2 } from 'lucide-vue-next'
import { inject, ref } from 'vue'
import { formatTime } from '../utils'
import { Button, createResource } from 'frappe-ui'
import EvaluationModal from '@/components/Modals/EvaluationModal.vue'

const dayjs = inject('$dayjs')
const user = inject('$user')
const showEvalModal = ref(false)

const props = defineProps({
	batch: {
		type: String,
		default: null,
	},
	courses: {
		type: Array,
		default: [],
	},
	isStudent: {
		type: Boolean,
		default: false,
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
</script>
