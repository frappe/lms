<template>
	<StudentSheetLayout
		v-model="show"
		data-batch-student-sheet
		:name="student?.member_name ?? null"
		:subtitle="student ? student.email || student.member : ''"
		:image="student?.member_image ?? null"
		:badge="
			student
				? { label: TRACK_LABELS[track](), theme: TRACK_THEMES[track] }
				: null
		"
		:last-active="lastActiveText"
		:ready="Boolean(student)"
		:error="loadError"
		:timeline="timeline"
		:activity-note="upcoming ? notStartedText : undefined"
		:primary-action="primaryAction"
		:removal="removal"
		@removed="emit('removed')"
		@retry="load"
	>
		<div class="flex flex-col rounded-[12px] bg-surface-gray-1">
			<button
				type="button"
				class="flex flex-col gap-[10px] rounded-t-[12px] px-[18px] py-[14px] text-start hover:bg-surface-gray-2"
				:title="__('Jump to courses')"
				@click="jumpToCourses"
			>
				<span class="flex w-full items-baseline justify-between gap-3">
					<span class="flex min-w-0 flex-col gap-1">
						<span
							data-focus-label
							class="text-[12px]"
							:class="focus.labelClass"
						>
							{{ focus.label }}
						</span>
						<span data-focus-title class="truncate text-[14px] text-ink-gray-8">
							{{ focus.title }}
						</span>
					</span>
					<span class="shrink-0 text-[13px] tabular-nums text-ink-gray-6">
						{{ progressText }}
					</span>
				</span>
				<span
					v-if="totalLessons"
					class="flex h-1.5 w-full gap-1"
					aria-hidden="true"
				>
					<span
						v-for="group in segments"
						:key="group.key"
						class="flex min-w-0 gap-0.5"
						:style="{ flex: group.lessons }"
					>
						<span
							v-for="lesson in group.segments"
							:key="lesson.key"
							data-segment
							class="min-w-0 flex-1 rounded-[2px]"
							:class="lesson.segment"
							:title="lesson.tip"
						/>
					</span>
				</span>
			</button>
			<div class="mx-[18px] border-t border-outline-gray-2" />
			<div
				class="grid grid-cols-[repeat(auto-fit,minmax(110px,1fr))] gap-1 px-[10px] py-2"
			>
				<component
					:is="fact.jump ? 'button' : 'div'"
					v-for="fact in facts"
					:key="fact.label"
					:type="fact.jump ? 'button' : undefined"
					data-fact
					class="flex min-w-0 flex-col gap-1 rounded-[8px] px-2 py-1.5 text-start"
					:class="fact.jump ? 'hover:bg-surface-gray-2' : ''"
					:title="fact.hint"
					@click="fact.jump?.()"
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
						<span v-if="fact.alert" class="sr-only">{{ fact.alert }}: </span
						>{{ fact.value }}
					</span>
				</component>
			</div>
		</div>

		<div class="flex flex-col divide-y divide-outline-gray-1">
			<section
				v-if="assessmentCount.total"
				ref="assessmentsSection"
				data-section="assessments"
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
				<div v-if="assessmentsOpen" class="flex flex-col pt-1">
					<template v-for="group in assessmentGroups" :key="group.label">
						<span class="pb-0.5 pt-[10px] text-[12px] text-ink-gray-6">
							{{ group.label }}
						</span>
						<ul class="flex flex-col">
							<li
								v-for="(row, index) in group.rows"
								:key="row.key"
								data-assessment
								class="flex min-h-[38px] items-center gap-[10px]"
								:class="index ? 'border-t border-outline-gray-1' : ''"
							>
								<span class="flex min-w-0 flex-1 items-baseline gap-2">
									<span
										class="truncate text-[13px]"
										:class="row.pending ? 'text-ink-gray-6' : 'text-ink-gray-8'"
									>
										{{ row.title }}
									</span>
									<span class="shrink-0 text-[12px] text-ink-gray-4">
										{{ row.kind }}
									</span>
								</span>
								<span
									v-if="row.score"
									class="text-[13px] tabular-nums text-ink-gray-6"
								>
									{{ row.score }}
								</span>
								<Badge
									v-if="row.badge"
									:theme="row.badge.theme"
									:label="row.badge.label"
								/>
								<span v-if="row.pending" class="text-[12px] text-ink-gray-4">
									{{ row.pending }}
								</span>
							</li>
						</ul>
					</template>
				</div>
			</section>

			<section
				v-if="student?.classes.length"
				ref="attendanceSection"
				data-section="attendance"
				class="flex scroll-mt-4 flex-col py-2 first:pt-0 last:pb-0"
				:aria-label="__('Attendance')"
			>
				<button
					type="button"
					class="-mx-2 flex min-h-9 items-center gap-2 rounded-[8px] px-2 text-start hover:bg-surface-gray-1"
					:aria-expanded="attendanceOpen"
					@click="attendanceOpen = !attendanceOpen"
				>
					<span class="flex-1 text-[14px] font-semibold text-ink-gray-8">
						{{ __('Attendance') }}
					</span>
					<span class="text-[12px] text-ink-gray-6">
						{{ attendanceMeta }}
					</span>
					<span
						class="size-4 text-ink-gray-4"
						:class="chevronClass(attendanceOpen)"
						aria-hidden="true"
					/>
				</button>
				<div v-if="attendanceOpen" class="flex flex-col gap-2 pt-2">
					<div class="flex flex-wrap gap-1">
						<span
							v-for="cls in classStrip"
							:key="cls.key"
							data-class
							role="img"
							class="box-border size-4 rounded-[4px] border"
							:class="cls.cell"
							:title="cls.tip"
							:aria-label="cls.tip"
						/>
					</div>
					<div
						class="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-ink-gray-6"
					>
						<span
							class="w-full tabular-nums sm:me-auto sm:w-auto"
							data-class-range
						>
							{{ classRange }}
						</span>
						<span class="inline-flex items-center gap-1.5">
							<span
								class="size-2.5 rounded-[3px] bg-surface-green-4"
								aria-hidden="true"
							/>
							{{ __('Attended') }}
						</span>
						<span class="inline-flex items-center gap-1.5">
							<span
								class="size-2.5 rounded-[3px] bg-surface-red-4"
								aria-hidden="true"
							/>
							{{ __('Missed') }}
						</span>
						<span class="inline-flex items-center gap-1.5">
							<span
								class="box-border size-2.5 rounded-[3px] border border-dashed border-outline-gray-3"
								aria-hidden="true"
							/>
							{{ __('Upcoming') }}
						</span>
					</div>
				</div>
			</section>

			<section
				ref="coursesSection"
				data-section="courses"
				class="flex scroll-mt-4 flex-col py-2 first:pt-0 last:pb-0"
				:aria-label="__('Courses')"
			>
				<button
					type="button"
					class="-mx-2 flex min-h-9 items-center gap-2 rounded-[8px] px-2 text-start hover:bg-surface-gray-1"
					:aria-expanded="coursesOpen"
					@click="coursesOpen = !coursesOpen"
				>
					<span class="flex-1 text-[14px] font-semibold text-ink-gray-8">
						{{ __('Courses') }}
					</span>
					<span class="text-[12px] tabular-nums text-ink-gray-6">
						{{ progressText }}
					</span>
					<span
						class="size-4 text-ink-gray-4"
						:class="chevronClass(coursesOpen)"
						aria-hidden="true"
					/>
				</button>
				<div v-if="coursesOpen" class="flex flex-col gap-[14px] pt-2">
					<p v-if="!courses.length" class="text-[13px] text-ink-gray-6">
						{{ __('This batch has no courses.') }}
					</p>
					<div
						v-for="course in courses"
						:key="course.key"
						class="flex flex-col"
					>
						<div
							class="flex justify-between gap-2 pb-1 text-[12px] text-ink-gray-6"
						>
							<span>{{ course.title }}</span>
							<span
								class="tabular-nums"
								:class="course.complete ? 'text-ink-green-8' : ''"
							>
								{{ course.count }}
							</span>
						</div>
						<ul class="flex flex-col">
							<li
								v-for="chapter in course.chapters"
								:key="chapter.key"
								class="flex min-h-7 items-center gap-[10px] text-[13px]"
								:data-mark="chapter.mark"
							>
								<span
									class="inline-flex size-3.5 shrink-0 items-center justify-center"
									aria-hidden="true"
								>
									<span
										v-if="chapter.mark === 'done'"
										class="lucide-check size-3.5 text-ink-gray-5"
									/>
									<span
										v-else-if="chapter.mark === 'current'"
										class="size-1.5 rounded-full bg-surface-gray-10"
									/>
									<span
										v-else
										class="size-[5px] rounded-full bg-surface-gray-4"
									/>
								</span>
								<span
									class="min-w-0 flex-1 truncate"
									:class="CHAPTER_INK[chapter.mark]"
								>
									{{ chapter.title }}
								</span>
								<span class="shrink-0 text-[12px] tabular-nums text-ink-gray-6">
									{{ chapter.count }}
								</span>
							</li>
						</ul>
					</div>
				</div>
			</section>

			<section
				v-if="student?.feedback"
				data-section="feedback"
				class="flex flex-col gap-[10px] py-3 last:pb-0"
				:aria-label="__('Feedback')"
			>
				<div class="flex items-baseline justify-between gap-2">
					<h3 class="text-[14px] font-semibold text-ink-gray-8">
						{{ __('Feedback') }}
					</h3>
					<span class="text-[12px] text-ink-gray-6">
						{{ feedbackRating }}
					</span>
				</div>
				<p
					v-if="student?.feedback?.text"
					class="rounded-[10px] bg-surface-gray-1 px-[14px] py-3 text-[13px] leading-[1.5] text-ink-gray-7"
				>
					{{ student?.feedback?.text }}
				</p>
			</section>
		</div>
	</StudentSheetLayout>
</template>
<script setup lang="ts">
import { Badge, createResource, toast } from 'frappe-ui'
import { computed, ref, watch } from 'vue'
import StudentSheetLayout from '@/components/Dashboard/StudentSheetLayout.vue'
import { TRACK_LABELS, TRACK_THEMES } from '@/utils/dashboard/filters'
import {
	allCoursesFinished,
	courseFinished,
	isLowAttendance,
	sheetAssessmentGroups,
	sheetClassStrip,
	sheetCourses,
	sheetSegments,
	sheetTimeline,
} from '@/utils/dashboard/batchStudent'
import dayjs from '@/utils/dayjs'
import { firstLoadError } from '@/utils/loadError'
import { openExternal } from '@/utils/openExternal'
import { resourceErrorMessage } from '@/utils/resource'
import {
	chapterTitle,
	chevronClass,
	daysAgo,
	relativeDay,
	revealSection,
} from '@/utils/dashboard/studentSheet'
import type { LessonMark, SheetAction } from '@/utils/dashboard/studentSheet'
import { useStudentReminder } from '@/composables/dashboard/useDashboard'
import type { BatchState, BatchStudentDetail, StudentTrack } from '@/types'

const props = defineProps<{
	batchName: string
	enrollment: string
	state: BatchState
	startDate: string
}>()

const emit = defineEmits<{
	removed: []
}>()

const show = defineModel<boolean>({ required: true })

const attendanceOpen = ref<boolean>(true)
const assessmentsOpen = ref<boolean>(true)
const coursesOpen = ref<boolean>(false)
const attendanceSection = ref<HTMLElement | null>(null)
const assessmentsSection = ref<HTMLElement | null>(null)
const coursesSection = ref<HTMLElement | null>(null)

// Literal class names, so Tailwind emits each one.
const CHAPTER_INK: Record<LessonMark, string> = {
	done: 'text-ink-gray-6',
	current: 'text-ink-gray-8',
	todo: 'text-ink-gray-6',
}

// A failed first load shows in the sheet, which offers to retry.
const detail = createResource<BatchStudentDetail>({
	url: 'lms.lms.dashboard.batch.get_batch_student_detail',
})
const loadError = computed(() => firstLoadError(detail))

// A failed re-load keeps the student on screen, so only a toast can say so.
const load = (): void => {
	detail
		.submit({ batch: props.batchName, enrollment: props.enrollment })
		.catch((error: unknown) => {
			if (detail.data)
				toast.error(resourceErrorMessage(error, __('Could not load student')))
		})
}

watch(
	() => props.enrollment,
	() => {
		attendanceOpen.value = true
		assessmentsOpen.value = true
		coursesOpen.value = false
		load()
	},
	{ immediate: true }
)

const student = computed<BatchStudentDetail | null>(() => detail.data ?? null)
const upcoming = computed<boolean>(() => props.state === 'upcoming')

const startText = computed<string>(() => dayjs(props.startDate).format('D MMM'))

const notStartedText = computed<string>(() =>
	__('Nothing yet · the batch starts {0}').format(startText.value)
)

const track = computed<StudentTrack>(() =>
	upcoming.value ? 'not_started' : student.value?.track ?? 'not_started'
)

const totalLessons = computed<number>(() =>
	(student.value?.courses ?? []).reduce(
		(sum, course) => sum + course.lessons,
		0
	)
)
const completedLessons = computed<number>(() =>
	(student.value?.courses ?? []).reduce(
		(sum, course) => sum + course.completed,
		0
	)
)

const progressText = computed<string>(() =>
	__('{0} of {1} lessons').format(
		String(completedLessons.value),
		String(totalLessons.value)
	)
)

const lastActiveText = computed<string>(() => {
	const data = student.value
	if (upcoming.value || !data?.last_active || !completedLessons.value) return ''
	return __('Active {0}').format(relativeDay(daysAgo(data.last_active)))
})

const segments = computed(() =>
	student.value ? sheetSegments(student.value, upcoming.value) : []
)
const classStrip = computed(() =>
	student.value ? sheetClassStrip(student.value.classes) : []
)
const classRange = computed<string>(() => {
	const dates = classStrip.value.map((cls) => cls.date)
	if (!dates.length) return ''
	const first = fullDate(dates[0]!)
	const last = fullDate(dates[dates.length - 1]!)
	return first === last ? first : `${first} – ${last}`
})
const assessmentGroups = computed(() =>
	student.value ? sheetAssessmentGroups(student.value) : []
)
const courses = computed(() =>
	student.value ? sheetCourses(student.value) : []
)
const timeline = computed(() =>
	student.value ? sheetTimeline(student.value, daysAgo) : []
)

const assessmentCount = computed(() => {
	const rows = assessmentGroups.value.flatMap((group) => group.rows)
	return {
		total: rows.length,
		passed: rows.filter((row) => row.badge?.theme === 'green').length,
		review: rows.filter((row) => row.badge?.theme === 'amber').length,
	}
})

const assessmentsMeta = computed<string>(() => {
	const { total, passed, review } = assessmentCount.value
	if (upcoming.value)
		return __('{0} total · none due yet').format(String(total))
	const meta = __('{0} of {1} passed').format(String(passed), String(total))
	return review ? __('{0} · {1} to review').format(meta, String(review)) : meta
})

const attendanceMeta = computed<string>(() => {
	const data = student.value
	if (!data) return ''
	if (upcoming.value || !data.held)
		return __('{0} classes scheduled').format(String(data.classes.length))
	return __('{0} of {1} attended').format(
		String(data.attended),
		String(data.held)
	)
})

const fullDate = (at: string): string => dayjs(at).format('D MMM YYYY')

const classStart = (date: string, time: string | null): string =>
	time
		? dayjs(`${date.slice(0, 10)} ${time}`).format('ddd D MMM, h:mm a')
		: dayjs(date).format('ddd D MMM')

interface Focus {
	label: string
	labelClass: string
	title: string
}

const startingFocus = (data: BatchStudentDetail): Focus => {
	const days = Math.max(
		dayjs(props.startDate).startOf('day').diff(dayjs().startOf('day'), 'day'),
		0
	)
	let label = __('Batch starts in {0} days').format(String(days))
	if (days === 0) label = __('Batch starts today')
	else if (days === 1) label = __('Batch starts tomorrow')
	const first = data.classes[0]
	return {
		label,
		labelClass: 'text-ink-gray-6',
		title: first
			? `${first.title} · ${classStart(first.date, first.time)}`
			: __('Starts {0}').format(startText.value),
	}
}

const evaluationFocus = (data: BatchStudentDetail): Focus | null => {
	const { request, result, certificate } = data.evaluation_detail
	if (certificate)
		return {
			label: __('Certified'),
			labelClass: 'text-ink-green-8',
			title: __('{0} · issued {1}').format(
				certificate.name,
				fullDate(certificate.issue_date)
			),
		}
	if (data.evaluation.status === 'scheduled' && request)
		return {
			label: __('Evaluation scheduled'),
			labelClass: 'text-ink-blue-8',
			title: [classStart(request.date, request.start_time)]
				.concat(request.evaluator_name ? [request.evaluator_name] : [])
				.join(' · '),
		}
	if (data.evaluation.status === 'failed' && result)
		return {
			label: __('Did not pass evaluation'),
			labelClass: 'text-ink-red-7',
			title: __('Evaluated {0}').format(fullDate(result.date)),
		}
	return null
}

const learningFocus = (data: BatchStudentDetail): Focus => {
	if (allCoursesFinished(data))
		return {
			label: __('Completed all courses'),
			labelClass: 'text-ink-green-8',
			title: __('Evaluation not requested'),
		}
	const idle = data.last_active ? daysAgo(data.last_active) : 0
	let label = __('Currently on')
	if (data.track === 'at_risk')
		label =
			idle > 14
				? __('Currently on · at risk, inactive {0} days').format(String(idle))
				: __('Currently on · at risk')
	else if (data.track === 'behind') label = __('Currently on · behind schedule')
	const course = data.courses.find((row) => !courseFinished(row))
	const next = course?.up_next
	let title = __('No courses yet')
	if (course)
		title = next
			? __('{0} · {1} · lesson {2} of {3}').format(
					course.title,
					chapterTitle(next.chapter),
					String(next.number),
					String(next.of)
			  )
			: __('{0} · not started').format(course.title)
	return {
		label,
		labelClass: ['at_risk', 'behind'].includes(data.track)
			? 'text-ink-amber-8'
			: 'text-ink-gray-6',
		title,
	}
}

const focus = computed<Focus>(() => {
	const data = student.value
	if (!data) return { label: '', labelClass: '', title: '' }
	if (upcoming.value) return startingFocus(data)
	return evaluationFocus(data) ?? learningFocus(data)
})

const jumpToCourses = (): Promise<void> =>
	revealSection(
		() => coursesSection.value,
		() => (coursesOpen.value = true)
	)

interface Fact {
	label: string
	value: string
	valueClass: string
	hint: string | undefined
	jump: (() => void) | null
	alert?: string
}

const EVALUATION_INK = {
	not_requested: 'text-ink-gray-8',
	scheduled: 'text-ink-blue-8',
	passed: 'text-ink-green-8',
	failed: 'text-ink-red-7',
}

const evaluationText = (data: BatchStudentDetail): string => {
	const { status, date } = data.evaluation
	if (status === 'scheduled')
		return date
			? __('Scheduled {0}').format(dayjs(date).format('D MMM'))
			: __('Scheduled')
	if (status === 'passed') return __('Passed')
	if (status === 'failed') return __('Failed')
	return __('Not requested')
}

const facts = computed<Fact[]>(() => {
	const data = student.value
	if (!data) return []
	const plain = 'text-ink-gray-8'
	const lowAttendance =
		!upcoming.value && isLowAttendance(data.attended, data.held)
	const { total, passed } = assessmentCount.value
	return [
		{
			label: __('Attendance'),
			value:
				upcoming.value || !data.held
					? '—'
					: __('{0} of {1} classes').format(
							String(data.attended),
							String(data.held)
					  ),
			valueClass: lowAttendance ? 'font-medium text-ink-red-7' : plain,
			alert: lowAttendance ? __('Low attendance') : undefined,
			hint: data.classes.length ? __('Jump to attendance') : undefined,
			jump: data.classes.length
				? () =>
						revealSection(
							() => attendanceSection.value,
							() => (attendanceOpen.value = true)
						)
				: null,
		},
		{
			label: __('Assessments'),
			value:
				upcoming.value || !total
					? '—'
					: __('{0} of {1} passed').format(String(passed), String(total)),
			valueClass: plain,
			hint: total ? __('Jump to assessments') : undefined,
			jump: total
				? () =>
						revealSection(
							() => assessmentsSection.value,
							() => (assessmentsOpen.value = true)
						)
				: null,
		},
		{
			label: __('Evaluation'),
			value: evaluationText(data),
			valueClass: EVALUATION_INK[data.evaluation.status],
			hint: undefined,
			jump: null,
		},
		{
			label: __('Joined'),
			value: dayjs(data.enrolled_on).format('D MMM'),
			valueClass: plain,
			hint: undefined,
			jump: null,
		},
	]
})

const feedbackRating = computed<string>(() => {
	const rating = student.value?.feedback?.rating
	return rating == null
		? __('Not rated')
		: __('{0} of 5').format(rating.toFixed(1))
})

const { reminder, sendReminder: submitReminder } = useStudentReminder(
	'lms.lms.dashboard.batch.send_batch_reminder'
)

const sendReminder = (): void =>
	submitReminder({ batch: props.batchName, enrollment: props.enrollment })

const certificateUrl = computed<string>(() => {
	const certificate = student.value?.evaluation_detail.certificate
	if (!certificate) return ''
	return `/courses/${encodeURIComponent(
		certificate.course
	)}/${encodeURIComponent(certificate.name)}`
})

const primaryAction = computed<SheetAction>(() =>
	certificateUrl.value
		? {
				label: __('View certificate'),
				loading: false,
				run: () => openExternal(certificateUrl.value),
		  }
		: {
				label: __('Send reminder'),
				loading: reminder.loading,
				run: sendReminder,
		  }
)

const removal = computed(() => {
	const name = student.value?.member_name ?? ''
	return {
		label: __('Remove from batch'),
		title: __('Remove {0} from the batch?').format(name),
		message: __(
			'They lose access to the batch, its live classes and announcements. Their course enrollments, progress and payment records are kept.'
		),
		doctype: 'LMS Batch Enrollment',
		enrollment: props.enrollment,
		removed: __('{0} removed from the batch').format(name),
	}
})
</script>
