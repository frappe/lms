<template>
	<StudentSheetLayout
		v-model="show"
		data-course-student-sheet
		:name="student?.member_name ?? null"
		:subtitle="student ? student.email || student.member : ''"
		:image="student?.member_image ?? null"
		:badge="student ? { label: stageLabel, theme: stageTheme } : null"
		:last-active="lastActiveText"
		:ready="Boolean(student)"
		:error="loadError"
		:timeline="timeline"
		:primary-action="primaryAction"
		:removal="removal"
		@removed="emit('unenrolled')"
		@retry="load"
	>
		<div class="flex flex-col rounded-[12px] bg-surface-gray-1">
			<button
				type="button"
				class="flex flex-col gap-[10px] rounded-t-[12px] px-[18px] py-[14px] text-start hover:bg-surface-gray-2"
				:title="__('Jump to lessons')"
				@click="jumpToLessons"
			>
				<span class="flex w-full items-baseline justify-between gap-3">
					<span class="flex min-w-0 flex-col gap-1">
						<span class="text-[12px]" :class="focus.labelClass">
							{{ focus.label }}
						</span>
						<span class="truncate text-[14px] text-ink-gray-8">
							{{ focus.title }}
						</span>
					</span>
					<span class="shrink-0 text-[13px] tabular-nums text-ink-gray-6">
						{{ progressText }}
					</span>
				</span>
				<span class="flex h-1.5 w-full gap-1" aria-hidden="true">
					<span
						v-for="chapter in chapters"
						:key="chapter.number"
						class="flex min-w-0 gap-0.5"
						:style="{ flex: chapter.lessons.length }"
						:title="chapter.tip"
					>
						<span
							v-for="lesson in chapter.lessons"
							:key="lesson.name"
							class="min-w-0 flex-1 rounded-[2px]"
							:class="lesson.segment"
							:title="lesson.tip"
						/>
					</span>
				</span>
			</button>
			<div class="mx-[18px] border-t border-outline-gray-2" />
			<div
				class="grid grid-cols-[repeat(auto-fit,minmax(96px,1fr))] gap-1 px-[10px] py-2"
			>
				<component
					:is="fact.jump ? 'button' : 'div'"
					v-for="fact in facts"
					:key="fact.label"
					:type="fact.jump ? 'button' : undefined"
					class="flex min-w-0 flex-col gap-1 rounded-[8px] px-2 py-1.5 text-start"
					:class="fact.jump ? 'hover:bg-surface-gray-2' : ''"
					:title="fact.jump ? __('Jump to assessments') : undefined"
					@click="fact.jump ? jumpToAssessments() : undefined"
				>
					<span
						class="inline-flex items-center gap-1 text-[12px] text-ink-gray-6"
					>
						{{ fact.label }}
						<span
							v-if="fact.jump"
							class="lucide-arrow-down size-3 text-ink-gray-4"
							aria-hidden="true"
						/>
					</span>
					<span
						class="truncate text-[14px] tabular-nums"
						:class="fact.valueClass"
					>
						{{ fact.value }}
					</span>
				</component>
			</div>
		</div>

		<div class="flex flex-col divide-y divide-outline-gray-1">
			<section
				v-if="assessments.length"
				ref="assessmentsSection"
				class="flex scroll-mt-4 flex-col py-2 first:pt-0 last:pb-0"
				:aria-label="__('Assessments')"
			>
				<button
					type="button"
					class="-mx-2 flex min-h-9 items-center gap-2 rounded-[8px] px-2 text-start hover:bg-surface-gray-1"
					:aria-expanded="assessmentsOpen"
					@click="assessmentsOpen = !assessmentsOpen"
				>
					<span class="flex-1 text-[14px] font-semibold text-ink-gray-8">
						{{ __('Assessments') }}
					</span>
					<span class="text-[12px] text-ink-gray-6">
						{{ assessmentsMeta }}
					</span>
					<span
						class="size-4 text-ink-gray-4"
						:class="chevronClass(assessmentsOpen)"
						aria-hidden="true"
					/>
				</button>
				<ul v-if="assessmentsOpen" class="flex flex-col pt-1">
					<li
						v-for="(assessment, index) in assessments"
						:key="assessment.key"
						class="flex min-h-[38px] items-center gap-[10px]"
						:class="index ? 'border-t border-outline-gray-1' : ''"
					>
						<span class="flex min-w-0 flex-1 items-baseline gap-2">
							<span
								class="truncate text-[13px]"
								:class="
									assessment.score || assessment.badge
										? 'text-ink-gray-8'
										: 'text-ink-gray-6'
								"
							>
								{{ assessment.title }}
							</span>
							<span class="shrink-0 text-[12px] text-ink-gray-4">
								{{ assessment.kind }}
							</span>
						</span>
						<span
							v-if="assessment.score"
							class="text-[13px] tabular-nums text-ink-gray-6"
						>
							{{ assessment.score }}
						</span>
						<Badge
							v-if="assessment.badge"
							:theme="assessment.badge.theme"
							:label="assessment.badge.label"
						/>
						<span v-else class="text-[12px] text-ink-gray-4">
							{{ __('Not attempted') }}
						</span>
					</li>
				</ul>
			</section>

			<section
				ref="lessonsSection"
				class="flex scroll-mt-4 flex-col py-2 first:pt-0 last:pb-0"
				:aria-label="__('Lessons')"
			>
				<button
					type="button"
					class="-mx-2 flex min-h-9 items-center gap-2 rounded-[8px] px-2 text-start hover:bg-surface-gray-1"
					:aria-expanded="lessonsOpen"
					@click="lessonsOpen = !lessonsOpen"
				>
					<span class="flex-1 text-[14px] font-semibold text-ink-gray-8">
						{{ __('Lessons') }}
					</span>
					<span class="text-[12px] tabular-nums text-ink-gray-6">
						{{ progressText }}
					</span>
					<span
						class="size-4 text-ink-gray-4"
						:class="chevronClass(lessonsOpen)"
						aria-hidden="true"
					/>
				</button>
				<div v-if="lessonsOpen" class="flex flex-col gap-[14px] pt-2">
					<p v-if="!chapters.length" class="text-[13px] text-ink-gray-6">
						{{ __('This course has no lessons yet.') }}
					</p>
					<div
						v-for="chapter in chapters"
						:key="chapter.number"
						class="flex flex-col"
					>
						<div
							class="flex justify-between gap-2 pb-1 text-[12px] text-ink-gray-6"
						>
							<span>{{ chapter.title }}</span>
							<span
								class="tabular-nums"
								:class="chapter.complete ? 'text-ink-green-8' : ''"
							>
								{{ chapter.count }}
							</span>
						</div>
						<ul class="flex flex-col">
							<li
								v-for="lesson in chapter.lessons"
								:key="lesson.name"
								class="flex min-h-7 items-center gap-[10px] text-[13px]"
								:title="lesson.tip"
								:data-mark="lesson.mark"
							>
								<span
									class="inline-flex size-3.5 shrink-0 items-center justify-center"
									aria-hidden="true"
								>
									<span
										v-if="lesson.mark === 'done'"
										class="lucide-check size-3.5 text-ink-gray-5"
									/>
									<span
										v-else-if="lesson.mark === 'current'"
										class="size-1.5 rounded-full bg-surface-gray-10"
									/>
									<span
										v-else
										class="size-[5px] rounded-full bg-surface-gray-4"
									/>
								</span>
								<span
									class="min-w-0 flex-1 truncate"
									:class="LESSON_INK[lesson.mark]"
								>
									{{ lesson.title }}
								</span>
							</li>
						</ul>
					</div>
				</div>
			</section>
		</div>
	</StudentSheetLayout>
</template>
<script setup lang="ts">
import { Badge, createResource, toast } from 'frappe-ui'
import type { BadgeProps } from 'frappe-ui'
import { computed, ref, watch } from 'vue'
import StudentSheetLayout from '@/components/Dashboard/StudentSheetLayout.vue'
import { STAGE_LABELS } from '@/utils/dashboard/filters'
import {
	sheetAssessments,
	sheetChapters,
	sheetTimeline,
} from '@/utils/dashboard/courseStudent'
import { serverTime } from '@/utils/dayjs'
import { firstLoadError } from '@/utils/loadError'
import { openExternal } from '@/utils/openExternal'
import { resourceErrorMessage } from '@/utils/resource'
import {
	chevronClass,
	daysAgo,
	lessonTitle,
	relativeDay,
	revealSection,
} from '@/utils/dashboard/studentSheet'
import type { LessonMark } from '@/utils/dashboard/studentSheet'
import { useStudentReminder } from '@/composables/dashboard/useDashboard'
import type { CourseStudentDetail, StudentStage } from '@/types'

const props = defineProps<{
	courseName: string
	enrollment: string
}>()

const emit = defineEmits<{
	unenrolled: []
	certified: []
}>()

const show = defineModel<boolean>({ required: true })

const assessmentsOpen = ref<boolean>(true)
const lessonsOpen = ref<boolean>(false)
const assessmentsSection = ref<HTMLElement | null>(null)
const lessonsSection = ref<HTMLElement | null>(null)

const STAGE_THEMES: Record<StudentStage, BadgeProps['theme']> = {
	not_started: 'gray',
	in_progress: 'blue',
	completed: 'green',
	certified: 'green',
}

// Literal class names, so Tailwind emits each one.
const LESSON_INK: Record<LessonMark, string> = {
	done: 'text-ink-gray-7',
	current: 'font-medium text-ink-gray-8',
	todo: 'text-ink-gray-6',
}

// A failed first load shows in the sheet, which offers to retry.
const detail = createResource<CourseStudentDetail>({
	url: 'lms.lms.dashboard.course.get_course_student_detail',
})
const loadError = computed(() => firstLoadError(detail))

// A failed re-load keeps the student on screen, so only a toast can say so.
const load = (): void => {
	detail
		.submit({ course: props.courseName, enrollment: props.enrollment })
		.catch((error: unknown) => {
			if (detail.data)
				toast.error(resourceErrorMessage(error, __('Could not load student')))
		})
}

watch(
	() => props.enrollment,
	() => {
		assessmentsOpen.value = true
		lessonsOpen.value = false
		load()
	},
	{ immediate: true }
)

const student = computed<CourseStudentDetail | null>(() => detail.data ?? null)

const formatDate = (at: string): string => serverTime(at).format('D MMM YYYY')

const stageLabel = computed<string>(() => {
	const data = student.value
	if (!data) return ''
	return data.inactive ? __('Inactive 14+ days') : STAGE_LABELS[data.stage]()
})

const stageTheme = computed<BadgeProps['theme']>(() => {
	const data = student.value
	if (!data) return 'gray'
	return data.inactive ? 'amber' : STAGE_THEMES[data.stage]
})

const lastActiveText = computed<string>(() => {
	const data = student.value
	if (!data?.last_active || !data.lessons_completed) return ''
	return __('Active {0}').format(relativeDay(daysAgo(data.last_active)))
})

const chapters = computed(() =>
	student.value ? sheetChapters(student.value, formatDate) : []
)
const totalLessons = computed<number>(() =>
	chapters.value.reduce((sum, chapter) => sum + chapter.lessons.length, 0)
)
const assessments = computed(() =>
	student.value ? sheetAssessments(student.value) : []
)
const timeline = computed(() =>
	student.value ? sheetTimeline(student.value, daysAgo) : []
)

const progressText = computed<string>(() =>
	__('{0} of {1} lessons').format(
		String(student.value?.lessons_completed ?? 0),
		String(totalLessons.value)
	)
)

const assessmentsMeta = computed<string>(() =>
	__('{0} of {1} attempted').format(
		String(assessments.value.filter((row) => row.score || row.badge).length),
		String(assessments.value.length)
	)
)

const focus = computed(() => {
	const data = student.value
	const certificate = data?.certificate_detail
	if (certificate)
		return {
			label: __('Certified'),
			labelClass: 'text-ink-green-8',
			title: certificate.name,
		}
	const next = data?.up_next
	if (!data || !next)
		return {
			label: __('Finished'),
			labelClass: 'text-ink-green-8',
			title: __('All {0} lessons complete').format(String(totalLessons.value)),
		}
	const idle = data.last_active ? daysAgo(data.last_active) : 0
	let label = __('Currently on')
	if (!data.lessons_completed) label = __('Not started · begins with')
	else if (data.inactive)
		label = __('Currently on · no progress in {0} days').format(String(idle))
	return {
		label,
		labelClass: data.inactive ? 'text-ink-amber-8' : 'text-ink-gray-6',
		title: `${next.number} ${lessonTitle(next.title)}`,
	}
})

interface Fact {
	label: string
	value: string
	valueClass: string
	jump: boolean
}

const facts = computed<Fact[]>(() => {
	const data = student.value
	if (!data) return []
	const rows: Fact[] = []
	const plain = 'text-ink-gray-8'
	if (assessments.value.some((row) => row.key.startsWith('quiz:')))
		rows.push({
			label: __('Quiz average'),
			value:
				data.quizzes.average === null
					? '—'
					: `${Math.round(data.quizzes.average)}%`,
			valueClass: plain,
			jump: true,
		})
	if (data.assignments.total)
		rows.push({
			label: __('Assignments'),
			value: __('{0} of {1} submitted').format(
				String(data.assignments.total - data.assignments.not_attempted),
				String(data.assignments.total)
			),
			valueClass: plain,
			jump: true,
		})
	let certificate = __('Not yet')
	if (data.certificate_detail) certificate = __('Issued')
	else if (data.stage === 'completed') certificate = __('Ready to issue')
	if (data.certificate_detail || data.certification_enabled)
		rows.push({
			label: __('Certificate'),
			value: certificate,
			valueClass: data.certificate_detail ? 'text-ink-green-8' : plain,
			jump: false,
		})
	rows.push({
		label: __('Enrolled'),
		value: formatDate(data.enrolled_on),
		valueClass: plain,
		jump: false,
	})
	return rows
})

const jumpToLessons = (): Promise<void> =>
	revealSection(
		() => lessonsSection.value,
		() => (lessonsOpen.value = true)
	)

const jumpToAssessments = (): Promise<void> =>
	revealSection(
		() => assessmentsSection.value,
		() => (assessmentsOpen.value = true)
	)

const { reminder, sendReminder: submitReminder } = useStudentReminder(
	'lms.lms.dashboard.course.send_course_reminder'
)

const sendReminder = (): void =>
	submitReminder({ course: props.courseName, enrollment: props.enrollment })

const issuing = createResource<{ name: string; course: string }>({
	url: 'lms.lms.dashboard.course.issue_course_certificate',
})

const issueCertificate = (): void => {
	issuing
		.submit({ course: props.courseName, enrollment: props.enrollment })
		.then(
			() => {
				toast.success(__('Certificate issued'))
				load()
				emit('certified')
			},
			(error: unknown) =>
				toast.error(
					resourceErrorMessage(error, __('Could not issue the certificate'))
				)
		)
}

const certificateUrl = computed<string>(() => {
	const certificate = student.value?.certificate_detail
	if (!certificate) return ''
	return `/courses/${encodeURIComponent(props.courseName)}/${encodeURIComponent(
		certificate.name
	)}`
})

const primaryAction = computed(() => {
	if (certificateUrl.value)
		return {
			label: __('View certificate'),
			loading: false,
			run: () => openExternal(certificateUrl.value),
		}
	if (student.value?.stage === 'completed') {
		if (!student.value.certification_enabled) return null
		return {
			label: __('Issue certificate'),
			loading: issuing.loading,
			run: issueCertificate,
		}
	}
	return {
		label: __('Send reminder'),
		loading: reminder.loading,
		run: sendReminder,
	}
})

const removal = computed(() => {
	const name = student.value?.member_name ?? ''
	return {
		label: __('Remove from course'),
		title: __('Remove {0} from the course?').format(name),
		message: __(
			'Their progress ({0} of {1} lessons) and course access will be removed. Payment records are kept.'
		).format(
			String(student.value?.lessons_completed ?? 0),
			String(totalLessons.value)
		),
		doctype: 'LMS Enrollment',
		enrollment: props.enrollment,
		removed: __('{0} removed from the course').format(name),
	}
})
</script>
