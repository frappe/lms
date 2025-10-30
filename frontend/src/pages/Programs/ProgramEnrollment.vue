<template>
	<Dialog
		v-model="show"
		:options="{
			size: '2xl',
		}"
	>
		<template #body-title>
			<div v-if="program.data" class="text-xl font-semibold text-ink-gray-9">
				{{ __('Enrollment for Program {0}').format(program.data?.name) }}
			</div>
		</template>
		<template #body-content>
			<div v-if="program.data" class="text-base">
				<div class="bg-surface-blue-2 text-ink-blue-3 p-2 rounded-md leading-5">
					<span>
						{{
							__('This program consists of {0} courses').format(
								program.data.courses.length
							)
						}}
					</span>
					<span v-if="program.data.enforce_course_order">
						{{
							__(
								' designed as a structured learning path to guide your progress. Courses in this program must be taken in order, and each course will unlock as you complete the previous one. '
							)
						}}
					</span>
					<span v-else>
						{{
							__(
								' designed as a learning path to guide your progress. You may take the courses in any order that suits you. '
							)
						}}
					</span>
					<span>
						{{ __('Are you sure you want to enroll?') }}
					</span>
				</div>

				<div class="mt-5">
					<div class="text-sm font-semibold text-ink-gray-5">
						{{ __('Courses in this Program') }}
					</div>
					<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
						<div
							v-for="course in program.data.courses"
							class="flex flex-col border p-2 rounded-md h-full"
						>
							<div class="font-semibold leading-5 mb-2">
								{{ course.title }}
							</div>

							<!-- <div class="text-sm text-ink-gray-7 mb-8">
                                {{ course.short_introduction }}
                            </div> -->

							<div
								class="flex items-center space-x-5 text-sm text-ink-gray-5 mb-8"
							>
								<Tooltip :text="__('Lessons')">
									<span class="flex items-center space-x-1">
										<BookOpen class="size-3 stroke-1.5" />
										<span> {{ course.lessons }} {{ __('lessons') }} </span>
									</span>
								</Tooltip>

								<Tooltip :text="__('Enrolled Students')">
									<span class="flex items-center space-x-1">
										<User class="size-3 stroke-1.5" />
										<span> {{ course.enrollments }} {{ __('students') }} </span>
									</span>
								</Tooltip>

								<!-- <Tooltip v-if="course.rating" :text="__('Average Rating')">
                                    <span class="flex items-center space-x-1">
                                        <Star class="size-3 stroke-1.5" />
                                        <span>
                                            {{ course.rating }} {{ __("rating") }}
                                        </span>
                                    </span>
                                </Tooltip> -->
							</div>

							<div class="flex items-center space-x-1 mt-auto">
								<UserAvatar :user="course.instructors[0]" />
								<span>
									{{ course.instructors[0].full_name }}
								</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		</template>
		<template #actions="{ close }">
			<div class="flex justify-end space-x-2 group">
				<Button variant="solid" @click="enrollInProgram(close)">
					{{ __('Confirm Enrollment') }}
				</Button>
			</div>
		</template>
	</Dialog>
</template>
<script setup lang="ts">
import { Button, call, createResource, Dialog, toast, Tooltip } from 'frappe-ui'
import { inject, watch } from 'vue'
import { BookOpen, Star, User } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import CourseInstructors from '@/components/CourseInstructors.vue'

const show = defineModel()
const user = inject<any>('$user')
const router = useRouter()

const props = defineProps<{
	programName: any
}>()

const program = createResource({
	url: 'lms.lms.utils.get_program_details',
	makeParams(values: any) {
		return {
			program_name: props.programName,
		}
	},
	auto: false,
})

watch(
	() => props.programName,
	() => {
		if (props.programName) {
			program.reload()
		}
	}
)

const enrollInProgram = (close: () => void) => {
	call('lms.lms.utils.enroll_in_program', {
		program: props.programName,
	})
		.then(() => {
			toast.success(__('Successfully enrolled in program'))
			router.push({
				name: 'ProgramDetail',
				params: { programName: props.programName },
			})
			close()
		})
		.catch((error: any) => {
			toast.error(__('Failed to enroll in program: {0}').format(error.message))
			console.error('Enrollment Error:', error)
		})
}
</script>
