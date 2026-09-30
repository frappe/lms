<template>
	<SubmissionsPage
		:config="config"
		:locked-filters="lockedFilters"
		:can-delete="!isStudent"
	>
		<template #cell="{ column, row, value }">
			<div v-if="column.key === 'member_name'" class="flex items-center gap-2">
				<Avatar
					:image="(row as ListRow).member_image as string"
					:label="value as string"
					size="sm"
				/>
				<span class="truncate">{{ value }}</span>
			</div>
			<Badge
				v-else-if="column.key === 'status'"
				:theme="value === 'Passed' ? 'green' : 'red'"
			>
				{{ value }}
			</Badge>
			<div
				v-else-if="column.key === 'modified'"
				class="text-sm text-ink-gray-5"
			>
				{{ value }}
			</div>
			<div v-else>{{ value }}</div>
		</template>
	</SubmissionsPage>
</template>

<script setup lang="ts">
import { Avatar, Badge } from 'frappe-ui'
import type dayjsType from 'dayjs'
import type {} from 'dayjs/plugin/relativeTime'
import { computed, inject } from 'vue'
import SubmissionsPage from '@/components/Submissions/SubmissionsPage.vue'
import type { ListRow, SessionUser, SubmissionsConfig } from '@/types'

const user = inject<SessionUser>('$user')!
const dayjs = inject<typeof dayjsType>('$dayjs')!

const isStudent = computed<boolean>(
	() =>
		!user.data?.is_instructor &&
		!user.data?.is_moderator &&
		!user.data?.is_evaluator
)

const lockedFilters = computed<Record<string, string>>(() => {
	const locked: Record<string, string> = {}
	if (isStudent.value && user.data?.name) locked.member = user.data.name
	return locked
})

const config: SubmissionsConfig = {
	doctype: 'LMS Programming Exercise Submission',
	fields: [
		'name',
		'exercise',
		'exercise_title',
		'member_name',
		'member_image',
		'status',
		'modified',
	],
	orderBy: 'modified desc',
	columns: [
		{ label: __('Member'), key: 'member_name', width: 2, icon: 'lucide-user' },
		{
			label: __('Exercise'),
			key: 'exercise_title',
			width: 2,
			icon: 'lucide-code',
		},
		{
			label: __('Status'),
			key: 'status',
			width: 1,
			align: 'left',
			icon: 'lucide-check-circle',
		},
		{
			label: __('Modified'),
			key: 'modified',
			width: 1,
			align: 'left',
			icon: 'lucide-clock',
		},
	],
	filters: [
		{
			key: 'exercise',
			doctype: 'LMS Programming Exercise',
			placeholder: 'Filter by Exercise',
		},
		{ key: 'member', doctype: 'User', placeholder: 'Filter by Member' },
		{
			key: 'status',
			placeholder: 'Filter by Status',
			options: [
				{ label: '', value: '' },
				{ label: __('Passed'), value: 'Passed' },
				{ label: __('Failed'), value: 'Failed' },
			],
		},
	],
	getRowRoute: (row: ListRow) => ({
		name: 'ProgrammingExerciseSubmission',
		params: {
			exerciseID: String(row.exercise),
			submissionID: String(row.name),
		},
	}),
	parentCrumb: {
		label: __('Programming Exercises'),
		route: { name: 'ProgrammingExercises' },
	},
	scopeCrumb: {
		filterKey: 'exercise',
		doctype: 'LMS Programming Exercise',
		titleField: 'title',
		route: (value: string) => ({
			name: 'ProgrammingExerciseForm',
			params: { exerciseID: value },
		}),
	},
	title: 'Submissions',
	pageTitle: 'Programming Exercise Submissions',
	emptyName: 'Programming Exercise Submissions',
	emptyIcon: 'lucide-file-code',
	transform: (rows: ListRow[]) =>
		rows.map((row) => ({
			...row,
			modified: dayjs(row.modified as string).fromNow(),
		})),
}
</script>
