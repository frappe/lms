<template>
	<ListPage
		:breadcrumbs="breadcrumbs"
		:title="__('Questions')"
		layout="list"
		:columns="columns"
		:rows="questions.data || []"
		:loading="questions.list.loading"
		:list-resource="questions"
		:has-next-page="questions.hasNextPage"
		:list-options="listOptions"
		v-model:search="search"
		empty-name="Questions"
		empty-icon="lucide-circle-help"
		@load-more="questions.next()"
	>
		<template #actions>
			<Button v-if="!readOnlyMode" variant="solid" @click="newQuestion">
				<template #prefix>
					<span class="lucide-plus size-4" />
				</template>
				{{ __('New question') }}
			</Button>
		</template>

		<template #filters>
			<FormControl
				v-model="typeFilter"
				type="select"
				:options="typeFilterOptions"
				:aria-label="__('Filter by type')"
			/>
		</template>

		<template #cell="{ column, row, value }">
			<div v-if="column.key === 'question'" class="truncate">
				{{ htmlToText(value as string).trim() }}
			</div>
			<Badge v-else-if="column.key === 'type'" theme="gray" variant="subtle">
				<template #prefix
					><span
						:class="[questionTypeMeta(row as LmsQuestionListRow).icon, 'size-3']"
				/></template>
				{{ questionTypeMeta(row as LmsQuestionListRow).label }}
			</Badge>
			<div
				v-else-if="column.key === 'modified'"
				class="text-sm text-ink-gray-5"
			>
				{{ value }}
			</div>
			<div v-else>{{ value }}</div>
		</template>

		<template #selection-actions="{ unselectAll, selections }">
			<span class="sr-only" role="status">{{ deleteAnnouncement }}</span>
			<Button
				variant="ghost"
				:label="deleting ? __('Deleting…') : __('Delete')"
				:aria-disabled="deleting"
				:class="deleting ? 'cursor-not-allowed' : ''"
				@click="deleteQuestions(selections)"
			>
				<template #icon>
					<span
						class="lucide-trash-2 size-4"
						:class="deleting ? 'opacity-60' : ''"
						aria-hidden="true"
					/>
				</template>
			</Button>
		</template>
	</ListPage>

	<QuestionDialog
		v-model:open="dialogOpen"
		:questionName="editing"
		@saved="questions.reload()"
	/>
</template>

<script setup lang="ts">
import {
	Badge,
	Button,
	createListResource,
	FormControl,
	usePageMeta,
} from 'frappe-ui'
import { computed, inject, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useDebounceFn } from '@vueuse/core'
import { sessionStore } from '@/stores/session'
import ListPage from '@/components/Layouts/ListPage.vue'
import QuestionDialog from '@/components/Quiz/QuestionDialog.vue'
import { QUESTION_TYPES, questionTypeMeta } from '@/utils/quizQuestion'
import { htmlToText } from '@/utils/inertHtml'
import { useBulkDeleteAction } from '@/utils/bulkDelete'
import type {
	Breadcrumb,
	ListColumn,
	ListViewOptions,
	SessionUser,
} from '@/types'
import type { LmsQuestionListRow, QuestionTypeFilter } from '@/types/questions'

const { brand } = sessionStore()
const dayjs = inject('$dayjs') as (date: string) => {
	format: (fmt: string) => string
}
const user = inject('$user') as SessionUser
const router = useRouter()
const readOnlyMode = window.read_only_mode
const search = ref<string>('')
const typeFilter = ref<QuestionTypeFilter>('')

onMounted(() => {
	// Evaluators are deliberately out: LMS Question grants read to System Manager,
	// Moderator and Course Creator only, and both quiz endpoints reject them, so an
	// evaluator would land on an empty list behind a New question button that 403s.
	if (!user.data?.is_moderator && !user.data?.is_instructor) {
		router.push({ name: 'Courses' })
		return
	}
	questions.reload()
})

// 'Choices' alone can't tell single from multiple; only these two filter
// values add `multiple` on top of `type`.
function typeDbFilters(): Record<string, unknown> {
	switch (typeFilter.value) {
		case 'single':
			return { type: 'Choices', multiple: 0 }
		case 'multiple':
			return { type: 'Choices', multiple: 1 }
		case 'user_input':
			return { type: 'User Input' }
		case 'open_ended':
			return { type: 'Open Ended' }
		default:
			return {}
	}
}

// `%` and `_` are LIKE wildcards, so a search for "100%" or "snake_case" matched far
// more than it read like. The backslash is escaped first, or it would escape itself.
function escapeLike(value: string): string {
	return value.replace(/[\\%_]/g, (match) => `\\${match}`)
}

function activeFilters(): Record<string, unknown> {
	const active: Record<string, unknown> = { ...typeDbFilters() }
	if (search.value) active.question = ['like', `%${escapeLike(search.value)}%`]
	return active
}

// Debounced at the same 300ms as the question bank's own search box, which is the
// other place in this feature an author types into a list.
const reloadQuestions = useDebounceFn(() => {
	questions.update({ filters: activeFilters(), start: 0 })
	questions.reload()
}, 300)

watch([search, typeFilter], reloadQuestions)

const questions = createListResource<LmsQuestionListRow>({
	doctype: 'LMS Question',
	fields: ['name', 'question', 'type', 'multiple', 'owner', 'modified'],
	orderBy: 'modified desc',
	pageLength: 24,
	auto: false,
	transform(data: LmsQuestionListRow[]) {
		return data.map((row) => ({
			...row,
			modified: dayjs(row.modified).format('DD MMM YYYY'),
		}))
	},
})

const typeFilterOptions = computed(() => [
	{ label: __('All types'), value: '' },
	...QUESTION_TYPES.map((t: { value: string; label: string }) => ({
		label: t.label,
		value: t.value,
	})),
])

// A question is its own record, shared across quizzes, so a row opens it for
// editing rather than being a read-only line to be changed somewhere else.
const listOptions: ListViewOptions = {
	selectable: true,
	showTooltip: false,
	onRowClick: (row: { name: string }) => openQuestion(row.name),
}

const editing = ref('')
const dialogOpen = ref(false)

const openQuestion = (name: string) => {
	editing.value = name
	dialogOpen.value = true
}

const newQuestion = () => openQuestion('')

const columns = computed<ListColumn[]>(() => [
	{
		label: __('Question'),
		key: 'question',
		width: 3,
		icon: 'lucide-help-circle',
	},
	{ label: __('Type'), key: 'type', width: 1, icon: 'lucide-filter' },
	// LMS Question has no author field of its own, so this is frappe's `owner`:
	// whoever created the question, which is the same person until one exists.
	{ label: __('Author'), key: 'owner', width: 1, icon: 'lucide-user' },
	{
		label: __('Updated On'),
		key: 'modified',
		width: 1,
		align: 'right',
		icon: 'lucide-clock',
	},
])

const breadcrumbs = computed<Breadcrumb[]>(() => [
	{ label: __('Quizzes'), route: { name: 'Quizzes' } },
	{ label: __('Questions') },
])

// LMS Question deletion can fail per row (a question still in use by a quiz),
// so partial failure is reported row by row rather than all-or-nothing.
const {
	deleting,
	announcement: deleteAnnouncement,
	run: deleteQuestions,
} = useBulkDeleteAction('LMS Question', {
	announcement: () => __('Deleting questions…'),
	onDeleted: () => {
		questions.reload()
	},
	success: (deleted) =>
		deleted === 1
			? __('Question deleted successfully')
			: __('{0} questions deleted successfully').format(deleted),
	allFailed: ({ total, error }) =>
		(total === 1
			? __('Error deleting question: {0}')
			: __('Error deleting questions: {0}')
		).format(error),
	partial: ({ deleted, total, error }) =>
		__('{0} of {1} questions deleted; the rest remain selected: {2}').format(
			deleted,
			total,
			error
		),
})

usePageMeta(() => ({
	title: __('Questions'),
	icon: brand.favicon,
}))
</script>
