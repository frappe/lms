<template>
	<div>
		<div class="flex items-center justify-between mb-4">
			<div class="text-lg text-ink-gray-9 font-semibold">
				{{ __('Upcoming Evaluations') }}
			</div>
			<Button
				v-if="
					!upcoming_evals.data?.length ||
					upcoming_evals.length == courses.length
				"
				@click="openEvalModal"
			>
				{{ __('Schedule Evaluation') }}
			</Button>
		</div>
		<div v-if="upcoming_evals.data?.length">
			<div class="grid grid-cols-3 gap-4">
				<div v-for="evl in upcoming_evals.data">
					<div class="border text-ink-gray-7 rounded-md p-3">
						<div class="flex justify-between mb-3">
							<span class="font-semibold text-ink-gray-9 leading-5">
								{{ evl.course_title }}
							</span>
							<Menu
								v-if="evl.date > dayjs().format()"
								as="div"
								class="relative inline-block text-left"
							>
								<div>
									<MenuButton class="inline-flex w-full justify-center">
										<EllipsisVertical class="w-4 h-4 stroke-1.5" />
									</MenuButton>
								</div>

								<transition
									enter-active-class="transition duration-100 ease-out"
									enter-from-class="transform scale-95 opacity-0"
									enter-to-class="transform scale-100 opacity-100"
									leave-active-class="transition duration-75 ease-in"
									leave-from-class="transform scale-100 opacity-100"
									leave-to-class="transform scale-95 opacity-0"
								>
									<MenuItems
										class="absolute mt-2 w-32 rounded-md bg-surface-white border p-1.5"
									>
										<MenuItem v-slot="{ active }">
											<Button
												variant="ghost"
												class="w-full"
												@click="cancelEvaluation(evl)"
											>
												<template #prefix>
													<Ban
														:active="active"
														class="size-4 stroke-1.5"
														aria-hidden="true"
													/>
												</template>
												{{ __('Cancel') }}
											</Button>
										</MenuItem>
									</MenuItems>
								</transition>
							</Menu>
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
		<div v-else class="text-sm italic text-ink-gray-5">
			{{ __('Please schedule an evaluation to get certified.') }}
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
import { inject, ref, getCurrentInstance } from 'vue'
import { formatTime } from '../utils'
import { Button, createResource, call } from 'frappe-ui'
import EvaluationModal from '@/components/Modals/EvaluationModal.vue'
import { Menu, MenuButton, MenuItems, MenuItem } from '@headlessui/vue'

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
	params: {
		student: user.data.name,
		courses: props.courses.map((course) => course.course),
		batch: props.batch,
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
