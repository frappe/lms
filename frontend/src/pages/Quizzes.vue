<template>
	<LayoutHeader>
		<template #left-header>
			<Breadcrumbs :items="breadcrumbs" />
		</template>
		<template #right-header>
			<Button v-if="!readOnlyMode" variant="solid" @click="createQuiz">
				<template #prefix>
					<span class="lucide-plus size-4" />
				</template>
				{{ __('Create') }}
			</Button>
		</template>
	</LayoutHeader>

	<div class="flex min-h-0 flex-1 flex-col pt-5">
		<div
			class="mx-5 mb-5 flex flex-col justify-between gap-y-4 sm:flex-row sm:items-center"
		>
			<div class="text-lg-semibold text-ink-gray-9">
				{{ __('{0} Quizzes').format(totalQuizzes.data || 0) }}
			</div>
			<FormControl v-model="search" type="text" placeholder="Search">
				<template #prefix>
					<span class="lucide-search size-4 text-ink-gray-5" />
				</template>
			</FormControl>
		</div>
		<div
			v-if="quizzes.loading && !quizzes.data"
			class="flex flex-1 items-center justify-center px-5"
		>
			<LoadingIndicator class="size-5 text-ink-gray-5" />
		</div>
		<ListView
			v-else-if="quizzes.data?.length"
			:columns="quizColumns"
			:rows="quizzes.data"
			row-key="name"
			:options="{ showTooltip: false, selectable: true }"
			class="flex-1 overflow-y-auto px-5"
		>
			<ListHeader class="mb-2 grid items-center rounded bg-surface-gray-2 p-2">
				<ListHeaderItem :item="item" v-for="item in quizColumns">
					<template #prefix="{ item }">
						<span :class="[item.icon, 'h-4 w-4']" aria-hidden="true" />
					</template>
				</ListHeaderItem>
			</ListHeader>
			<ListRows>
				<router-link
					v-for="row in quizzes.data"
					:to="{
						name: 'QuizForm',
						params: {
							quizID: row.name,
						},
					}"
				>
					<ListRow :row="row" class="hover:bg-surface-gray-2">
						<template #default="{ column, item }">
							<ListRowItem :item="row[column.key]" :align="column.align">
								<div v-if="column.key == 'show_answers'">
									<Checkbox v-model="row[column.key]" :disabled="true" />
								</div>
								<div
									v-else-if="column.key == 'modified'"
									class="text-sm text-ink-gray-5"
								>
									{{ row[column.key] }}
								</div>
								<div v-else>
									{{ row[column.key] }}
								</div>
							</ListRowItem>
						</template>
					</ListRow>
				</router-link>
			</ListRows>
			<ListSelectBanner class="bottom-50">
				<template #actions="{ unselectAll, selections }">
					<div class="flex gap-2">
						<Button
							variant="ghost"
							@click="deleteQuiz(selections, unselectAll)"
						>
							<span class="lucide-trash-2 size-4" />
						</Button>
					</div>
				</template>
			</ListSelectBanner>
		</ListView>
		<div v-else class="flex-1">
			<EmptyStateLayout name="Quizzes" icon="lucide-circle-help" />
		</div>
		<ListFooter
			v-model="pageLength"
			class="border-t px-3 py-2 sm:px-5"
			:options="{
				rowCount: quizzes.data?.length,
				totalCount: totalQuizzes.data,
			}"
		>
			<template #right>
				<div class="flex items-center">
					<Button
						v-if="quizzes.hasNextPage"
						:label="__('Load More')"
						@click="quizzes.next()"
					/>
					<div v-if="quizzes.hasNextPage" class="mx-3 h-[80%] border-l" />
					<div class="flex items-center gap-1 text-base text-ink-gray-5">
						<div>{{ quizzes.data?.length || 0 }}</div>
						<div>{{ __('of') }}</div>
						<div>{{ totalQuizzes.data || 0 }}</div>
					</div>
				</div>
			</template>
		</ListFooter>
	</div>
</template>
<script setup>
import {
	Breadcrumbs,
	Button,
	createListResource,
	createResource,
	FormControl,
	ListView,
	ListRows,
	ListRow,
	ListRowItem,
	ListHeader,
	ListHeaderItem,
	ListFooter,
	ListSelectBanner,
	LoadingIndicator,
	toast,
	usePageMeta,
	Checkbox,
} from 'frappe-ui'
import { useRouter } from 'vue-router'
import { computed, inject, onMounted, ref, watch } from 'vue'

import { sessionStore } from '@/stores/session'
import { useTelemetry } from 'frappe-ui/frappe'
import EmptyStateLayout from '@/components/Layouts/EmptyStateLayout.vue'
import LayoutHeader from '@/components/Layouts/LayoutHeader.vue'

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
		quizzes.update({ pageLength: value })
		quizzes.reload()
	},
})

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
				toast.error(__('Error creating quiz: {0}', error.message))
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
