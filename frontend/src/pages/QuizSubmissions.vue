<template>
	<ListPage
		:breadcrumbs="breadcrumbs"
		:title="__('Submissions')"
		layout="list"
		:columns="columns"
		:rows="submissions.data || []"
		:loading="submissions.list.loading"
		:list-resource="submissions"
		:has-next-page="submissions.hasNextPage"
		:list-options="listOptions"
		empty-name="Quiz Submissions"
		empty-icon="lucide-file-check"
		@load-more="submissions.next()"
	>
		<template #filters>
			<Link
				doctype="LMS Quiz"
				v-model="filters.quiz"
				align="end"
				:placeholder="__('Filter by Quiz')"
			/>
			<Link
				doctype="User"
				v-model="filters.member"
				align="end"
				:placeholder="__('Filter by Member')"
			/>
			<Link
				doctype="LMS Course"
				v-model="filters.course"
				align="end"
				:placeholder="__('Filter by Course')"
			/>
		</template>

		<template #cell="{ column, row, value }">
			<span v-if="column.key === 'score'">
				{{ (row as { score: number }).score }} /
				{{ (row as { score_out_of: number }).score_out_of }}
			</span>
			<span v-else-if="column.key === 'percentage'">{{ value }}%</span>
			<div
				v-else-if="column.key === 'creation'"
				class="text-sm text-ink-gray-5"
			>
				{{ value }}
			</div>
			<div v-else>{{ value }}</div>
		</template>

		<template #selection-actions="{ unselectAll, selections }">
			<Button
				variant="ghost"
				:label="__('Delete')"
				@click="deleteSubmissions(selections, unselectAll)"
			>
				<template #prefix>
					<span class="lucide-trash-2 size-4" aria-hidden="true" />
				</template>
			</Button>
		</template>
	</ListPage>
</template>

<script setup lang="ts">
import { Button, createListResource, usePageMeta } from 'frappe-ui'
import { computed, inject, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { sessionStore } from '@/stores/session'
import Link from '@/components/Controls/Link.vue'
import ListPage from '@/components/Layouts/pages/ListPage.vue'
import { useBulkDeleteAction } from '@/utils/bulkDelete'
import type { LMSQuizSubmission } from '@/types/lms/LMSQuizSubmission'
import type {
	Breadcrumb,
	ListColumn,
	ListRow,
	ListViewOptions,
	QuizSubmissionFilters,
	SessionUser,
} from '@/types'

const { brand } = sessionStore()
const dayjs = inject('$dayjs') as (date: string) => {
	format: (fmt: string) => string
}
const user = inject('$user') as SessionUser
const router = useRouter()

const filterFields: Array<keyof QuizSubmissionFilters> = [
	'quiz',
	'member',
	'course',
]
const filters = ref<QuizSubmissionFilters>({ quiz: '', member: '', course: '' })

// Read here, not in onMounted. The filters watcher is a pre-flush job, so a
// mutation in the mounted hook runs after it: the list would fetch twice and
// the unfiltered response could land last.
setFiltersFromRoute()

onMounted(() => {
	if (!user.data?.is_instructor && !user.data?.is_moderator) {
		router.push({ name: 'Courses' })
		return
	}
	submissions.reload()
})

function setFiltersFromRoute(): void {
	filterFields.forEach((field) => {
		const value = router.currentRoute.value.query[field]
		if (typeof value === 'string') filters.value[field] = value
	})
}

const submissions = createListResource<LMSQuizSubmission>({
	doctype: 'LMS Quiz Submission',
	fields: [
		'name',
		'quiz',
		'quiz_title',
		'member',
		'member_name',
		'score',
		'score_out_of',
		'percentage',
		'course',
		'creation',
	],
	orderBy: 'creation desc',
	pageLength: 24,
	filters: activeFilters(),
	auto: false,
	transform(data: LMSQuizSubmission[]) {
		return data.map((row) => ({
			...row,
			creation: dayjs(row.creation).format('DD MMM YYYY'),
		}))
	},
})

function activeFilters(): Record<string, string> {
	const active: Record<string, string> = {}
	filterFields.forEach((field) => {
		if (filters.value[field]) active[field] = filters.value[field]
	})
	return active
}

watch(
	filters,
	() => {
		const query = { ...router.currentRoute.value.query }
		filterFields.forEach((field) => {
			if (filters.value[field]) query[field] = filters.value[field]
			else delete query[field]
		})
		router.push({ query })

		submissions.update({ filters: activeFilters(), start: 0 })
		submissions.reload()
	},
	{ deep: true }
)

const { run: deleteSubmissions } = useBulkDeleteAction('LMS Quiz Submission', {
	onDeleted: () => {
		submissions.reload()
	},
	success: () => __('Submissions deleted successfully'),
	partial: ({ failed, total, error }) =>
		__('{0} of {1} submissions could not be deleted: {2}').format(
			failed,
			total,
			error
		),
})

const listOptions: ListViewOptions = {
	selectable: true,
	showTooltip: false,
	getRowRoute: (row: ListRow) => ({
		name: 'QuizSubmission',
		params: { submission: String(row.name) },
	}),
}

const columns = computed<ListColumn[]>(() => [
	{ label: __('Member'), key: 'member_name', width: 2, icon: 'lucide-user' },
	{
		label: __('Quiz'),
		key: 'quiz_title',
		width: 2,
		icon: 'lucide-help-circle',
	},
	{
		label: __('Score'),
		key: 'score',
		width: 1,
		align: 'center',
		icon: 'lucide-hash',
	},
	{
		label: __('Percentage'),
		key: 'percentage',
		width: 0.75,
		align: 'center',
		icon: 'lucide-percent',
	},
	{
		label: __('Submitted On'),
		key: 'creation',
		width: 1,
		align: 'right',
		icon: 'lucide-clock',
	},
])

// A filter is not a place, so the trail never names the quiz in scope. The quiz
// is already named by the filter control and by every row's Quiz column.
const breadcrumbs = computed<Breadcrumb[]>(() => [
	{ label: __('Quizzes'), route: { name: 'Quizzes' } },
	{ label: __('Submissions') },
])

usePageMeta(() => ({
	title: __('Quiz Submissions'),
	icon: brand.favicon,
}))
</script>
