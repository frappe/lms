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
<<<<<<< HEAD
import {
	Avatar,
	Badge,
	Button,
	createListResource,
	FormControl,
	usePageMeta,
	toast,
} from 'frappe-ui'
import type {
	ProgrammingExerciseSubmission,
	Filters,
	ListRow,
	ListViewOptions,
} from '@/types'
import { computed, inject, onMounted, ref, watch } from 'vue'
import { sessionStore } from '@/stores/session'
import { useRouter } from 'vue-router'
import Link from '@/components/Controls/Link.vue'
import { serverTime } from '@/utils/dayjs'
import ListPage from '@/components/Layouts/ListPage.vue'

const { brand } = sessionStore()
const user = inject('$user') as any
const filterFields = ['exercise', 'member', 'status']
const filters = ref<Filters>({
	exercise: '',
	member: '',
	status: '',
})
const router = useRouter()
const pageLength = ref<number>(24)
=======
import { Avatar, Badge } from 'frappe-ui'
import type dayjsType from 'dayjs'
import type {} from 'dayjs/plugin/relativeTime'
import { computed, inject } from 'vue'
import SubmissionsPage from '@/components/Submissions/SubmissionsPage.vue'
import type { ListRow, SessionUser, SubmissionsConfig } from '@/types'

const user = inject<SessionUser>('$user')!
const dayjs = inject<typeof dayjsType>('$dayjs')!
>>>>>>> dab7e3c (feat(assessments): align assessment routes and share one submissions list)

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
<<<<<<< HEAD
	pageLength: 24,
	transform(data: ProgrammingExercise[]) {
		return data.map((submission: ProgrammingExerciseSubmission) => {
			return {
				...submission,
				modified: serverTime(submission.modified).fromNow(),
			}
		})
	},
})

watch(filters.value, () => {
	let filtersToApply: Record<string, any> = {}
	filterFields.forEach((field) => {
		if (filters.value[field as keyof Filters]) {
			filtersToApply[field] = filters.value[field as keyof Filters]
			router.push({
				query: {
					...router.currentRoute.value.query,
					[field]: filters.value[field as keyof Filters],
				},
			})
		} else {
			delete filtersToApply[field]
			const query = { ...router.currentRoute.value.query }
			delete query[field]
			router.push({
				query,
			})
		}
	})

	submissions.update({
		filters: {
			...filtersToApply,
=======
	columns: [
		{ label: __('Member'), key: 'member_name', width: 2, icon: 'lucide-user' },
		{
			label: __('Exercise'),
			key: 'exercise_title',
			width: 2,
			icon: 'lucide-code',
>>>>>>> dab7e3c (feat(assessments): align assessment routes and share one submissions list)
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
