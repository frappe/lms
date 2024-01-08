<template>
	<div class="mb-10">
		<div class="text-lg font-semibold mb-4">
			{{ __('Upcoming Evaluations') }}
		</div>
		<div v-if="upcoming_evals.length">
			<div class="grid grid-cols-2">
				<div v-for="evl in upcoming_evals">
					<div class="border rounded-md p-3">
						<div class="font-medium mb-3">
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
							<span class="ml-2">
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
</template>
<script setup>
import { Calendar, Clock, UserCog2 } from 'lucide-vue-next'
import { inject } from 'vue'
import { formatTime } from '../utils'

const dayjs = inject('$dayjs')

const props = defineProps({
	upcoming_evals: {
		type: Array,
		default: [],
	},
})
</script>
