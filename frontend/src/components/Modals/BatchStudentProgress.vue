<template>
	<Dialog v-model="show" :options="{}">
		<template #body>
			<div class="p-5 space-y-8">
				<div class="flex items-center space-x-2">
					<Avatar :image="student.user_image" size="3xl" />
					<div class="space-y-1">
						<div class="flex items-center space-x-2">
							<div class="text-xl font-semibold">
								{{ student.full_name }}
							</div>
							<Badge :theme="student.progress === 100 ? 'green' : 'red'">
								{{ student.progress }}% {{ __('Complete') }}
							</Badge>
						</div>
						<div class="text-sm text-gray-700">
							{{ student.email }}
						</div>
					</div>
				</div>

				<!-- Assessments -->
				<div>
					<div>
						<div
							class="grid grid-cols-[70%,30%] border-b pl-2 pb-1 mb-2 text-xs text-gray-700 font-medium"
						>
							<span>
								{{ __('Assessment') }}
							</span>
							<span>
								{{ __('Progress') }}
							</span>
						</div>
						<div
							v-for="assessment in Object.keys(student.assessments)"
							class="grid grid-cols-[70%,30%] pl-2 mb-2 text-gray-700 font-medium"
						>
							<span>
								{{ assessment }}
							</span>
							<span v-if="isAssignment(student.assessments[assessment])">
								<Badge :theme="getStatusTheme(student.assessments[assessment])">
									{{ student.assessments[assessment] }}
								</Badge>
							</span>
							<span v-else>
								{{ student.assessments[assessment] }}
							</span>
						</div>
					</div>
				</div>

				<!-- Courses -->
				<div>
					<div>
						<div
							class="grid grid-cols-[70%,30%] mb-2 text-xs text-gray-700 border-b pl-2 pb-1 font-medium"
						>
							<span>
								{{ __('Courses') }}
							</span>
							<span>
								{{ __('Progress') }}
							</span>
						</div>
						<div
							v-for="course in Object.keys(student.courses)"
							class="grid grid-cols-[70%,30%] pl-2 mb-2 text-gray-700 font-medium"
						>
							<span>
								{{ course }}
							</span>
							<span>
								{{ Math.floor(student.courses[course]) }}
							</span>
						</div>
					</div>
				</div>

				<!-- <span class="mt-4">
                    {{ student }}
                </span> -->
			</div>
		</template>
	</Dialog>
</template>
<script setup>
import { Avatar, Badge, Dialog } from 'frappe-ui'
import ProgressBar from '@/components/ProgressBar.vue'

const show = defineModel()
const props = defineProps({
	student: {
		type: Object,
		default: null,
	},
})

const isAssignment = (value) => {
	return isNaN(value)
}

const getStatusTheme = (status) => {
	if (status === 'Pass') {
		return 'green'
	} else if (status == 'Not Graded') {
		return 'orange'
	} else {
		return 'red'
	}
}
</script>
