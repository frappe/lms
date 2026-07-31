<template>
	<ListPage
		:breadcrumbs="breadcrumbs"
		:title="__('{0} Quizzes').format(totalQuizzes.data || 0)"
		layout="list"
		:columns="quizColumns"
		:rows="quizzes.data || []"
		:list-options="listOptions"
		:total-count="totalQuizzes.data ?? 0"
		:loading="quizzes.list.loading"
		:has-next-page="quizzes.hasNextPage"
		v-model:page-length="pageLength"
		empty-name="Quizzes"
		empty-icon="lucide-circle-help"
		@load-more="quizzes.next()"
	>
		<template #actions>
			<Button v-if="!readOnlyMode" variant="solid" @click="createQuiz">
				<template #prefix>
					<span class="lucide-plus size-4" />
				</template>
				{{ __('Create') }}
			</Button>
		</template>

		<template #filters>
			<FormControl
				v-model="search"
				type="text"
				:placeholder="__('Search')"
				:aria-label="__('Search')"
			>
				<template #prefix>
					<span class="lucide-search size-4 text-ink-gray-5" />
				</template>
			</FormControl>
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

		<template #selection-actions="{ unselectAll, selections }">
			<Button
				variant="ghost"
				:label="__('Delete')"
				@click="deleteQuiz(selections, unselectAll)"
			>
				<span class="lucide-trash-2 size-4" />
			</Button>
		</template>
	</ListPage>
</template>
<script setup>
import {
	Button,
	Checkbox,
	createListResource,
	createResource,
	FormControl,
	toast,
	usePageMeta,
} from 'frappe-ui'
import ListPage from '@/components/Layouts/ListPage.vue'
import { useRouter } from 'vue-router'
import { computed, inject, onMounted, ref, watch } from 'vue'

import { sessionStore } from '@/stores/session'
import { useTelemetry } from 'frappe-ui/frappe'

const { brand } = sessionStore()
const { capture } = useTelemetry()
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
	totalQuizzes.update({
		filters: quizFilters.value,
	})
	totalQuizzes.reload()
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

const pageLength = computed({
	get: () => quizzes.pageLength,
	set: (value) => {
		// reload() ignores a new pageLength while start > 0: it refetches the
		// already loaded rows instead, so paging must be reset for it to apply.
		quizzes.update({ pageLength: value, start: 0 })
		quizzes.reload()
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

const totalQuizzes = createResource({
	url: 'frappe.client.get_count',
	params: {
		doctype: 'LMS Quiz',
		filters: quizFilters.value,
	},
	auto: true,
	cache: ['quizzes_count', user.data?.name],
	onError(err) {
		toast.error(err.messages?.[0] || err)
		console.error(err)
	},
})

const createQuiz = () => {
	quizzes.insert.submit(
		{
			title: __('Untitled Quiz'),
		},
		{
			onSuccess(data) {
				capture('quiz_created')
				router.push({
					name: 'QuizForm',
					params: {
						quizID: data.name,
					},
				})
			},
			onError(error) {
				toast.error(__('Error creating quiz: {0}').format(error.message))
			},
		}
	)
}

const deleteQuiz = (selections, unselectAll) => {
	Array.from(selections).forEach(async (quizName) => {
		await quizzes.delete.submit(quizName)
	})
	unselectAll()
	toast.success(__('Quizzes deleted successfully'))
}

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
			width: 0.5,
			align: 'center',
			icon: 'lucide-hash',
		},
		{
			label: __('Passing Percentage'),
			key: 'passing_percentage',
			width: 1,
			align: 'center',
			icon: 'lucide-percent',
		},
		{
			label: __('Max Attempts'),
			key: 'max_attempts',
			width: 0.5,
			align: 'center',
			icon: 'lucide-repeat',
		},
		{
			label: __('Show Answers'),
			key: 'show_answers',
			width: 0.5,
			align: 'center',
			icon: 'lucide-eye',
		},
		{
			label: __('Updated On'),
			key: 'modified',
			width: 1,
			align: 'right',
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
