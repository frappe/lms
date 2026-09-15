<template>
	<FormShell :title="title" size="2xl" @close="close">
		<template #default>
			<div v-if="refusal" class="p-4 text-base text-ink-gray-6">
				{{ refusal }}
			</div>
			<div v-else-if="loadingProgram" class="p-4 text-base text-ink-gray-6">
				{{ __('Loading...') }}
			</div>
			<div
				v-else-if="program.data"
				data-testid="program-enrollment-summary"
				class="text-base text-ink-gray-9"
			>
				<div class="bg-surface-blue-2 text-ink-blue-6 p-2 rounded-md leading-5">
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
					<div class="text-sm-semibold text-ink-gray-5">
						{{ __('Courses in this Program') }}
					</div>
					<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
						<div
							v-for="course in program.data.courses"
							:key="course.name"
							class="flex flex-col border border-outline-gray-2 p-2 rounded-md h-full"
						>
							<div class="font-semibold text-ink-gray-9 leading-5 mb-2">
								{{ course.title }}
							</div>

							<div
								class="flex items-center gap-x-5 text-sm text-ink-gray-5 mb-8"
							>
								<Tooltip :text="__('Lessons')">
									<span class="flex items-center gap-x-1">
										<span class="lucide-book-open size-3" />
										<span> {{ course.lessons }} {{ __('lessons') }} </span>
									</span>
								</Tooltip>

								<Tooltip :text="__('Enrolled Students')">
									<span class="flex items-center gap-x-1">
										<span class="lucide-user size-3" />
										<span> {{ course.enrollments }} {{ __('students') }} </span>
									</span>
								</Tooltip>
							</div>

							<div class="flex items-center gap-x-2.5 mt-auto">
								<UserAvatar :user="course.instructors[0]" />
								<span class="text-ink-gray-9">
									{{ course.instructors[0].full_name }}
								</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		</template>
		<template #actions>
			<div
				v-if="!refusal && !loadingProgram"
				class="flex items-center justify-end"
			>
				<HeaderButton
					data-testid="program-enrollment-confirm"
					:label="__('Save')"
					variant="solid"
					:loading="enrollment.loading"
					@click="enrollInProgram()"
				/>
			</div>
		</template>
	</FormShell>
</template>
<script setup lang="ts">
import { createResource, toast, Tooltip } from 'frappe-ui'
import { computed, inject, onMounted } from 'vue'
import FormShell from '@/components/FormShell.vue'
import HeaderButton from '@/components/HeaderButton.vue'
import { useFormRoute } from '@/composables/useFormRoute'
import type { SessionUser } from '@/types'

const props = defineProps<{
	programName: string
}>()

const user = inject<SessionUser>('$user')!
// Cast because Window carries no read_only_mode declaration; same shape as
// AssignmentForm.vue:108-110.
const readOnlyMode = (window as Window & { read_only_mode?: boolean })
	.read_only_mode

// The route is a child of Programs, so the list behind this page is never
// unmounted and its tab selection survives a close on its own — no query
// param needed to carry `currentTab` the way the batch forms carry a hash.
const parent = { name: 'Programs' }
const { close, saveAndReplace } = useFormRoute(parent)

const title = __('Enrollment for Program {0}').format(props.programName)

const program = createResource({
	url: 'lms.lms.utils.get_program_details',
	makeParams() {
		return { program_name: props.programName }
	},
	auto: false,
})

// The old `watch(() => props.programName)` fired only on a CHANGE, which never
// happened for a freshly mounted dialog and would never happen here either:
// Programs.vue keys its outlet on the program name, so a different program is a
// different component instance.
onMounted(() => {
	program.fetch()
})

const loadingProgram = computed(() => !program.data && !program.error)

// There was no v-if on the card that opened this — StudentPrograms only ever
// showed it under the "Published" tab, and that split is made server-side. So
// the gate a URL bypasses is the fetch's own: get_program_details throws for a
// guest when guest access is off, and for an unpublished program the viewer is
// not a member of (lms/lms/utils.py:2618-2627).
//
// UX gate, not an authorization boundary — enroll_in_program's own
// validate_program_enrollment is.
const refusal = computed(() => {
	if (readOnlyMode) return __('This site is in read-only mode.')
	if (!user.data) return __('Please log in to enroll in this program.')
	if (program.error)
		return (
			program.error.messages?.[0] ||
			__('You are not authorized to enroll in this program.')
		)
	return ''
})

const enrollment = createResource({
	url: 'lms.lms.utils.enroll_in_program',
	makeParams() {
		return { program: props.programName }
	},
})

const enrollInProgram = () => {
	if (refusal.value) return
	enrollment.submit(
		{},
		{
			onSuccess() {
				toast.success(__('Successfully enrolled in program'))
				// replace, not push: enrolling moves the student onward to the
				// program, and Back from there should reach the list rather than a
				// confirmation page for a program they have already joined.
				saveAndReplace({
					name: 'ProgramDetail',
					params: { programName: props.programName },
				})
			},
			onError(err: { messages?: string[] } | string) {
				toast.error(
					__('Failed to enroll in program: {0}').format(
						typeof err === 'string' ? err : err.messages?.[0] ?? ''
					)
				)
			},
		}
	)
}
</script>
