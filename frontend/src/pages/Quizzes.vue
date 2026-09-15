<template>
	<ListPage
		:breadcrumbs="breadcrumbs"
		layout="list"
		:columns="quizColumns"
		:rows="quizzes.data || []"
		:list-options="listOptions"
		:list-resource="quizzes"
		:loading="quizzes.list.loading"
		:has-next-page="quizzes.hasNextPage"
		v-model:search="search"
		empty-name="Quizzes"
		empty-icon="lucide-circle-help"
		@load-more="quizzes.next()"
	>
		<template #name="{ totalCount }">
			{{ __('{0} Quizzes').format(totalCount || 0) }}
		</template>

		<template #actions>
			<router-link :to="{ name: 'QuizSubmissions' }">
				<HeaderButton :label="__('Submissions')" icon="lucide-file-check" />
			</router-link>
			<router-link :to="{ name: 'Questions' }">
				<HeaderButton :label="__('Questions')" icon="lucide-circle-help" />
			</router-link>
			<Button v-if="!readOnlyMode" variant="solid" @click="createQuiz">
				<template #prefix>
					<span class="lucide-plus size-4" />
				</template>
				{{ __('Create') }}
			</Button>
		</template>

		<template #cell="{ column, row, value }">
			<Checkbox
				v-if="column.key == 'show_answers'"
				:modelValue="Boolean(value)"
				:disabled="true"
			/>
			<div v-else-if="column.key == 'modified'" class="text-sm text-ink-gray-5">
				{{ value }}
			</div>
			<div v-else>{{ value }}</div>
		</template>

		<template #selection-actions="{ selections }">
			<span class="sr-only" role="status">{{ deleteAnnouncement }}</span>
			<Button
				variant="ghost"
				:label="deleting ? __('Deleting…') : __('Delete')"
				:aria-disabled="deleting"
				:class="deleting ? 'cursor-not-allowed' : ''"
				@click="deleteQuiz(selections)"
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
</template>
<script setup>
import { Button, Checkbox, createListResource, usePageMeta } from 'frappe-ui'
import ListPage from '@/components/Layouts/pages/ListPage.vue'
import HeaderButton from '@/components/HeaderButton.vue'
import { useRouter } from 'vue-router'
import { computed, inject, onMounted, ref, watch } from 'vue'

import { sessionStore } from '@/stores/session'
import { useBulkDeleteAction } from '@/utils/bulkDelete'

const { brand } = sessionStore()
const user = inject('$user')
const dayjs = inject('$dayjs')
const router = useRouter()
const search = ref('')
const readOnlyMode = window.read_only_mode
const quizFilters = ref({})

onMounted(() => {
	if (
		!user.data?.is_moderator &&
		!user.data?.is_instructor &&
		!user.data?.is_evaluator
	) {
		router.push({ name: 'Courses' })
	}
})

watch(search, () => {
	quizFilters.value['title'] = ['like', `%${search.value}%`]
	quizzes.update({
		filters: quizFilters.value,
	})
	quizzes.reload()
})

const quizzes = createListResource({
	doctype: 'LMS Quiz',
	filters: quizFilters,
	fields: [
		'name',
		'title',
		'passing_percentage',
		'total_marks',
		'show_answers',
		'max_attempts',
		'modified',
	],
	auto: true,
	cache: ['quizzes', user.data?.name],
	orderBy: 'modified desc',
	pageLength: 24,
	transform(data) {
		return data.map((quiz) => {
			return {
				...quiz,
				modified: dayjs(quiz.modified).format('DD MMM YYYY'),
			}
		})
	},
})

const listOptions = computed(() => ({
	showTooltip: false,
	selectable: true,
	getRowRoute: (row) => ({
		name: 'QuizForm',
		params: { quizID: row.name },
	}),
}))

// Nothing is written here. A quiz named "Untitled Quiz" before the author had
// typed anything took its docname from that placeholder and kept it for good.
const createQuiz = () => router.push({ name: 'NewQuiz' })

const {
	deleting,
	announcement: deleteAnnouncement,
	run: deleteQuiz,
} = useBulkDeleteAction('LMS Quiz', {
	announcement: () => __('Deleting quizzes…'),
	onDeleted: () => {
		// Nothing refetches on its own now that `quizzes.delete` is not what
		// deletes. `reload()` rather than `list.fetch()`: past the first page the
		// latter appends the refetch onto the rows it just refetched.
		quizzes.reload()
	},
	success: (deleted) =>
		deleted === 1
			? __('Quiz deleted successfully')
			: __('{0} quizzes deleted successfully').format(deleted),
	allFailed: ({ total, error }) =>
		(total === 1
			? __('Error deleting quiz: {0}')
			: __('Error deleting quizzes: {0}')
		).format(error),
	partial: ({ deleted, total, error }) =>
		__('{0} of {1} quizzes deleted; the rest remain selected: {2}').format(
			deleted,
			total,
			error
		),
})

const quizColumns = computed(() => {
	return [
		{
			label: __('Title'),
			key: 'title',
			width: 2,
			icon: 'lucide-file-text',
		},
		{
			label: __('Total Marks'),
			key: 'total_marks',
			hideOnMobile: true,
			width: 0.5,
			align: 'left',
			icon: 'lucide-hash',
		},
		{
			label: __('Passing Percentage'),
			key: 'passing_percentage',
			hideOnMobile: true,
			width: 1,
			align: 'left',
			icon: 'lucide-percent',
		},
		{
			label: __('Max Attempts'),
			key: 'max_attempts',
			hideOnMobile: true,
			width: 0.5,
			align: 'left',
			icon: 'lucide-repeat',
		},
		{
			label: __('Show Answers'),
			key: 'show_answers',
			hideOnMobile: true,
			width: 0.5,
			align: 'left',
			icon: 'lucide-eye',
		},
		{
			label: __('Updated On'),
			key: 'modified',
			width: 1,
			align: 'left',
			icon: 'lucide-clock',
		},
	]
})

const breadcrumbs = computed(() => {
	return [
		{
			label: __('Quizzes'),
			route: {
				name: 'Quizzes',
			},
		},
	]
})

usePageMeta(() => {
	return {
		title: __('Quizzes'),
		icon: brand.favicon,
	}
})
</script>
