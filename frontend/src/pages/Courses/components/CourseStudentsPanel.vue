<template>
	<DashboardStudentList
		v-model:search="search"
		v-model:page-length="pageLength"
		:rows="rows"
		:total="total"
		:loading="loading"
		:error="error"
		:columns="columns"
		row-key="enrollment"
		:list-key="listKey"
		:start="start"
		:list-options="listOptions"
		:filter-label="filterLabel"
		:filter-choices="filterChoices"
		:filter-value="stage"
		:empty-description="__('Try a different name, email or stage')"
		@page="showPage"
		@retry="reload"
		@clear-filter="stage = null"
		@choose-filter="(value) => (stage = value as StudentFilter)"
	>
		<template #cell="{ columnKey, row, compact }">
			<StudentRowCell
				:column-key="columnKey"
				:student="asStudent(row)"
				:actions="rowActions(asStudent(row))"
				:compact="compact"
			/>
		</template>
		<template #selection-actions="{ selections, unselectAll }">
			<Button
				variant="ghost"
				theme="red"
				:label="__('Remove from course')"
				@click="confirmBulkRemove(selections, unselectAll)"
			/>
		</template>
	</DashboardStudentList>
	<Dialog
		v-model:open="showRemoveDialog"
		:title="unenrollTitle"
		:message="unenrollMessage"
		size="sm"
		:actions="removeActions"
	/>
</template>
<script setup lang="ts">
import { Button, Dialog, toast } from 'frappe-ui'
import type { DropdownOption } from 'frappe-ui'
import { computed } from 'vue'
import DashboardStudentList from '@/components/Dashboard/DashboardStudentList.vue'
import StudentRowCell from '@/pages/Courses/components/StudentRowCell.vue'
import { openExternal } from '@/utils/openExternal'
import { useScreenSize } from '@/utils/composables'
import { useDashboardStudents } from '@/composables/dashboard/useDashboardStudents'
import { useStudentReminder } from '@/composables/dashboard/useDashboard'
import { FILTER_GROUPS, FILTER_LABELS } from '@/utils/dashboard/filters'
import type {
	CourseStudentRow,
	CourseStudentsParams,
	ListColumn,
	ListRow as ListRowData,
	ListViewOptions,
	StudentFilter,
} from '@/types'

const props = defineProps<{
	courseName: string
	totalLessons: number
	paid?: boolean
}>()

const emit = defineEmits<{
	viewProgress: [student: CourseStudentRow]
	unenrolled: []
}>()

// Tailwind's `2xl`. Below it the charts column leaves the table too narrow for
// an enrollment date beside the rest.
const WIDE_SCREEN = 1536

const { size } = useScreenSize()
const stage = defineModel<StudentFilter | null>('stage', { default: null })

const {
	search,
	pageLength,
	rows,
	total,
	start,
	loading,
	error,
	reload,
	listKey,
	filterChoices,
	showPage,
	pending,
	showRemoveDialog,
	confirmRemove,
	confirmBulkRemove,
	removeActions,
} = useDashboardStudents<CourseStudentRow, StudentFilter, CourseStudentsParams>(
	{
		url: 'lms.lms.dashboard.course.get_course_students',
		cache: ['courseProgress', props.courseName],
		doctype: 'LMS Enrollment',
		stage,
		filterGroups: FILTER_GROUPS,
		filterLabels: FILTER_LABELS,
		params: (paging) => ({
			course: props.courseName,
			stage: stage.value,
			...paging,
		}),
		onRemoved: (done) => {
			reportUnenrolled(done)
			emit('unenrolled')
		},
	}
)

const filterLabel = computed<string | null>(() =>
	stage.value ? FILTER_LABELS[stage.value]() : null
)

const asStudent = (row: ListRowData): CourseStudentRow =>
	row as CourseStudentRow

const enrolledColumn = (): ListColumn[] =>
	size.width >= WIDE_SCREEN
		? [
				{
					label: __('Enrolled'),
					key: 'enrolled_on',
					width: 'minmax(0, 1.25fr)',
					hideOnMobile: true,
				},
		  ]
		: []

// A free course's every row would read "Free": the column says nothing
// until some student has paid or owes.
const paymentColumn = (): ListColumn[] =>
	props.paid || rows.value.some((row) => row.payment_status !== 'Free')
		? [{ label: __('Payment'), key: 'payment_status', width: 'minmax(0, 1fr)' }]
		: []

const columns = computed<ListColumn[]>(() => [
	{ label: __('Name'), key: 'member_name', width: 'minmax(0, 2fr)' },
	{ label: __('Progress'), key: 'progress', width: 'minmax(0, 0.8fr)' },
	...paymentColumn(),
	{
		label: __('Last active'),
		key: 'last_active',
		width: 'minmax(0, 1.25fr)',
		hideOnMobile: true,
	},
	...enrolledColumn(),
	{ label: '', key: 'actions', width: '3rem', kind: 'actions' },
])

const listOptions = computed<ListViewOptions>(() => ({
	selectable: true,
	showTooltip: false,
	selectionText: (count: number) =>
		count === 1
			? __('1 student selected')
			: __('{0} students selected').format(String(count)),
	onRowClick: (row: ListRowData) => emit('viewProgress', asStudent(row)),
}))

const certificateUrl = (student: CourseStudentRow): string =>
	`/courses/${encodeURIComponent(props.courseName)}/${encodeURIComponent(
		student.certificate ?? ''
	)}`

const { sendReminder } = useStudentReminder(
	'lms.lms.dashboard.course.send_course_reminder'
)

const rowActions = (student: CourseStudentRow): DropdownOption[] => [
	{
		label: __('View progress'),
		icon: 'lucide-list-checks',
		onClick: () => emit('viewProgress', student),
	},
	{
		label: __('View certificate'),
		icon: 'lucide-award',
		condition: () => Boolean(student.certificate),
		onClick: () => openExternal(certificateUrl(student)),
	},
	{
		label: __('Send reminder'),
		icon: 'lucide-send',
		condition: () => !student.certificate && student.stage !== 'completed',
		onClick: () =>
			sendReminder({
				course: props.courseName,
				enrollment: student.enrollment,
			}),
	},
	{
		label: __('Remove from course'),
		icon: 'lucide-user-minus',
		theme: 'red',
		onClick: () => confirmRemove([student]),
	},
]

const unenrollTitle = computed<string>(() => {
	const [first, ...others] = pending.value
	if (others.length)
		return __('Remove {0} students from the course?').format(
			String(pending.value.length)
		)
	return __('Remove {0} from the course?').format(first?.member_name ?? '')
})

const unenrollMessage = computed<string>(() => {
	const [first, ...others] = pending.value
	if (others.length || !first)
		return __(
			'Their progress and course access will be removed. Payment records are kept.'
		)
	return __(
		'Their progress ({0} of {1} lessons) and course access will be removed. Payment records are kept.'
	).format(String(first.lessons_completed), String(props.totalLessons))
})

const reportUnenrolled = (done: CourseStudentRow[]): void => {
	if (done.length === 1)
		toast.success(
			__('{0} removed from the course').format(done[0]!.member_name)
		)
	else if (done.length)
		toast.success(
			__('{0} students removed from the course').format(String(done.length))
		)
}
</script>
