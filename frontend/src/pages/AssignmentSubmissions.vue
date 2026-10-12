<template>
	<SubmissionsPage :config="config" :can-delete="canDelete">
		<template #cell="{ column, value }">
			<Badge
				v-if="column.key === 'status'"
				:theme="statusTheme(value as string)"
			>
				{{ value }}
			</Badge>
			<div v-else>{{ value }}</div>
		</template>
	</SubmissionsPage>
</template>

<script setup lang="ts">
import { Badge } from 'frappe-ui'
import type { BadgeProps } from 'frappe-ui'
import type dayjsType from 'dayjs'
import type {} from 'dayjs/plugin/relativeTime'
import { computed, inject, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import SubmissionsPage from '@/components/Submissions/SubmissionsPage.vue'
import type { ListRow, SessionUser, SubmissionsConfig } from '@/types'

const user = inject<SessionUser>('$user')!
const dayjs = inject<typeof dayjsType>('$dayjs')!
const router = useRouter()

onMounted(() => {
	if (!user.data?.is_instructor && !user.data?.is_moderator) {
		router.push({ name: 'Courses' })
		return
	}
})

// Course Creators (is_instructor) can read LMS Assignment Submission but not
// delete it, and DocPerm is the only gate.
const canDelete = computed<boolean>(() => Boolean(user.data?.is_moderator))

const statusTheme = (status: string): BadgeProps['theme'] => {
	if (status === 'Pass') return 'green'
	if (status === 'Not Graded') return 'blue'
	return 'red'
}

const config: SubmissionsConfig = {
	doctype: 'LMS Assignment Submission',
	fields: [
		'name',
		'assignment',
		'assignment_title',
		'member_name',
		'creation',
		'status',
	],
	orderBy: 'creation desc',
	columns: [
		{ label: __('Member'), key: 'member_name', width: 1, icon: 'lucide-user' },
		{
			label: __('Assignment'),
			key: 'assignment_title',
			width: 2,
			icon: 'lucide-clipboard-list',
		},
		{
			label: __('Submitted'),
			key: 'creation',
			width: 1,
			align: 'left',
			icon: 'lucide-clock',
		},
		{
			label: __('Status'),
			key: 'status',
			width: 1,
			align: 'left',
			icon: 'lucide-check-circle',
		},
	],
	filters: [
		{
			key: 'assignment',
			doctype: 'LMS Assignment',
			placeholder: 'Filter by Assignment',
		},
		{ key: 'member', doctype: 'User', placeholder: 'Filter by Member' },
		{
			key: 'status',
			placeholder: 'Filter by Status',
			options: [
				{ label: '', value: '' },
				{ label: __('Pass'), value: 'Pass' },
				{ label: __('Fail'), value: 'Fail' },
				{ label: __('Not Graded'), value: 'Not Graded' },
			],
		},
	],
	getRowRoute: (row: ListRow) => ({
		name: 'AssignmentSubmission',
		params: {
			assignmentID: String(row.assignment),
			submissionName: String(row.name),
		},
	}),
	parentCrumb: { label: __('Assignments'), route: { name: 'Assignments' } },
	scopeCrumb: {
		filterKey: 'assignment',
		doctype: 'LMS Assignment',
		titleField: 'title',
		route: (value: string) => ({
			name: 'AssignmentForm',
			params: { assignmentID: value },
		}),
	},
	title: 'Submissions',
	pageTitle: 'Assignment Submissions',
	emptyName: 'Assignment Submissions',
	emptyIcon: 'lucide-pencil',
	transform: (rows: ListRow[]) =>
		rows.map((row) => ({
			...row,
			creation: dayjs(row.creation as string).fromNow(),
		})),
}
</script>
