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
		:empty-description="__('Try a different name, email or filter')"
		@page="showPage"
		@retry="reload"
		@clear-filter="clearFilter"
		@choose-filter="(value) => (stage = value as BatchFilter)"
	>
		<template #cell="{ columnKey, row, compact }">
			<BatchStudentRowCell
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
				:label="__('Remove from batch')"
				@click="confirmBulkRemove(selections, unselectAll)"
			/>
		</template>
	</DashboardStudentList>
	<Dialog
		v-model:open="showRemoveDialog"
		:title="removeTitle"
		:message="removeMessage"
		size="sm"
		:actions="removeActions"
	/>
</template>
<script setup lang="ts">
import { Button, Dialog, toast } from 'frappe-ui'
import type { DropdownOption } from 'frappe-ui'
import { computed } from 'vue'
import DashboardStudentList from '@/components/Dashboard/DashboardStudentList.vue'
import BatchStudentRowCell from '@/pages/Batches/components/BatchStudentRowCell.vue'
import {
	BATCH_FILTER_GROUPS,
	BATCH_FILTER_LABELS,
} from '@/utils/dashboard/filters'
import { openExternal } from '@/utils/openExternal'
import { useDashboardStudents } from '@/composables/dashboard/useDashboardStudents'
import { useStudentReminder } from '@/composables/dashboard/useDashboard'
import type {
	BatchFilter,
	BatchStudentRow,
	BatchStudentsParams,
	ClassAttendanceFilter,
	ListColumn,
	ListRow as ListRowData,
	ListViewOptions,
} from '@/types'

const props = defineProps<{
	batchName: string
}>()

const emit = defineEmits<{
	viewProgress: [student: BatchStudentRow]
	removed: []
}>()

const stage = defineModel<BatchFilter | null>('stage', { default: null })
const classFilter = defineModel<ClassAttendanceFilter | null>('classFilter', {
	default: null,
})

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
} = useDashboardStudents<BatchStudentRow, BatchFilter, BatchStudentsParams>({
	url: 'lms.lms.dashboard.batch.get_batch_students',
	cache: ['batchDashboardStudents', props.batchName],
	doctype: 'LMS Batch Enrollment',
	stage,
	filterGroups: BATCH_FILTER_GROUPS,
	filterLabels: BATCH_FILTER_LABELS,
	params: (paging) => ({
		batch: props.batchName,
		stage: stage.value,
		...paging,
		live_class: classFilter.value?.liveClass ?? null,
		attendance: classFilter.value?.attendance ?? null,
	}),
	filters: [classFilter],
	onRemoved: (done) => {
		reportRemoved(done)
		emit('removed')
	},
})

const filterLabel = computed<string | null>(() => {
	if (classFilter.value)
		return (
			classFilter.value.attendance === 'missed'
				? __('Missed {0}')
				: __('Attended {0}')
		).format(classFilter.value.label)
	return stage.value ? BATCH_FILTER_LABELS[stage.value]() : null
})

const clearFilter = (): void => {
	stage.value = null
	classFilter.value = null
}

const asStudent = (row: ListRowData): BatchStudentRow => row as BatchStudentRow

const columns = computed<ListColumn[]>(() => [
	{ label: __('Student'), key: 'member_name', width: 'minmax(0, 2fr)' },
	{ label: __('Progress'), key: 'progress', width: 'minmax(0, 0.8fr)' },
	{ label: __('Attendance'), key: 'attendance', width: 'minmax(0, 0.8fr)' },
	{
		label: __('Last active'),
		key: 'last_active',
		width: 'minmax(0, 1fr)',
		hideOnMobile: true,
	},
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

const certificateUrl = (student: BatchStudentRow): string =>
	`/courses/${encodeURIComponent(
		student.certificate_course ?? ''
	)}/${encodeURIComponent(student.certificate ?? '')}`

const { sendReminder } = useStudentReminder(
	'lms.lms.dashboard.batch.send_batch_reminder'
)

const rowActions = (student: BatchStudentRow): DropdownOption[] => [
	{
		label: __('View progress'),
		icon: 'lucide-list-checks',
		onClick: () => emit('viewProgress', student),
	},
	{
		label: __('View certificate'),
		icon: 'lucide-award',
		condition: () => Boolean(student.certificate && student.certificate_course),
		onClick: () => openExternal(certificateUrl(student)),
	},
	{
		label: __('Send reminder'),
		icon: 'lucide-send',
		condition: () => !student.certificate,
		onClick: () =>
			sendReminder({ batch: props.batchName, enrollment: student.enrollment }),
	},
	{
		label: __('Remove from batch'),
		icon: 'lucide-user-minus',
		theme: 'red',
		onClick: () => confirmRemove([student]),
	},
]

const removeTitle = computed<string>(() => {
	const [first, ...others] = pending.value
	if (others.length)
		return __('Remove {0} students from the batch?').format(
			String(pending.value.length)
		)
	return __('Remove {0} from the batch?').format(first?.member_name ?? '')
})

const removeMessage = computed<string>(() =>
	__(
		'They lose access to the batch, its live classes and announcements. Their course enrollments, progress and payment records are kept.'
	)
)

const reportRemoved = (done: BatchStudentRow[]): void => {
	if (done.length === 1)
		toast.success(__('{0} removed from the batch').format(done[0]!.member_name))
	else if (done.length)
		toast.success(
			__('{0} students removed from the batch').format(String(done.length))
		)
}
</script>
