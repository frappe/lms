<template>
	<header
		class="sticky top-0 z-10 flex items-center justify-between border-b bg-surface-white px-3 py-2.5 sm:px-5"
	>
		<Breadcrumbs :items="breadcrumbs" />
		<Button v-if="!readOnlyMode" variant="solid" @click="showForm = true">
			<template #prefix>
				<Plus class="w-4 h-4" />
			</template>
			{{ __('Create') }}
		</Button>
	</header>
	<div class="py-5 mx-5">
		<div class="flex items-center justify-between mb-4">
			<div class="text-lg font-semibold text-ink-gray-7">
				{{
					quizzes.data?.length
						? __('{0} Quizzes').format(quizzes.data.length)
						: __('No Quizzes')
				}}
			</div>
			<FormControl v-model="search" type="text" placeholder="Search">
				<template #prefix>
					<FeatherIcon name="search" class="size-4 text-ink-gray-5" />
				</template>
			</FormControl>
		</div>
		<ListView
			v-if="quizzes.data?.length"
			:columns="quizColumns"
			:rows="quizzes.data"
			row-key="name"
			:options="{ showTooltip: false, selectable: true }"
		>
			<ListHeader
				class="mb-2 grid items-center space-x-4 rounded bg-surface-gray-2 p-2"
			>
				<ListHeaderItem :item="item" v-for="item in quizColumns">
					<template #prefix="{ item }">
						<FeatherIcon :name="item.icon?.toString()" class="h-4 w-4" />
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
					<ListRow :row="row">
						<template #default="{ column, item }">
							<ListRowItem :item="row[column.key]" :align="column.align">
								<div v-if="column.key == 'show_answers'">
									<FormControl
										type="checkbox"
										v-model="row[column.key]"
										:disabled="true"
									/>
								</div>
								<div
									v-else-if="column.key == 'modified'"
									class="text-xs text-ink-gray-5"
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
			<ListSelectBanner>
				<template #actions="{ unselectAll, selections }">
					<div class="flex gap-2">
						<Button
							variant="ghost"
							@click="deleteQuiz(selections, unselectAll)"
						>
							<FeatherIcon name="trash-2" class="h-4 w-4 stroke-1.5" />
						</Button>
					</div>
				</template>
			</ListSelectBanner>
		</ListView>
		<EmptyState v-else type="Quizzes" />
		<div v-if="quizzes.hasNextPage" class="flex justify-center my-5">
			<Button @click="quizzes.next()">
				{{ __('Load More') }}
			</Button>
		</div>
	</div>
	<Dialog
		v-model="showForm"
		:options="{
			title: __('Create a Quiz'),
			size: 'sm',
			actions: [
				{
					label: __('Save'),
					variant: 'solid',
					onClick({ close }) {
						insertQuiz(close)
					},
				},
			],
		}"
	>
		<template #body-content>
			<FormControl v-model="title" :label="__('Title')" type="text" />
		</template>
	</Dialog>
</template>
<script setup>
import {
	Breadcrumbs,
	Button,
	createListResource,
	Dialog,
	FeatherIcon,
	FormControl,
	ListView,
	ListRows,
	ListRow,
	ListRowItem,
	ListHeader,
	ListHeaderItem,
	ListSelectBanner,
	toast,
	usePageMeta,
} from 'frappe-ui'
import { useRouter } from 'vue-router'
import { computed, inject, onMounted, ref, watch } from 'vue'
import { Plus } from 'lucide-vue-next'
import { sessionStore } from '@/stores/session'
import EmptyState from '@/components/EmptyState.vue'

const { brand } = sessionStore()
const user = inject('$user')
const dayjs = inject('$dayjs')
const router = useRouter()
const search = ref('')
const readOnlyMode = window.read_only_mode
const quizFilters = ref({})
const showForm = ref(false)
const title = ref('')

onMounted(() => {
	if (!user.data?.is_moderator && !user.data?.is_instructor) {
		router.push({ name: 'Courses' })
	} else if (!user.data?.is_moderator) {
		quizFilters.value['owner'] = user.data?.name
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
	transform(data) {
		return data.map((quiz) => {
			return {
				...quiz,
				modified: dayjs(quiz.modified).fromNow(),
			}
		})
	},
})

const insertQuiz = (close) => {
	quizzes.insert.submit(
		{
			title: title.value,
		},
		{
			onSuccess(data) {
				toast.success(__('Quiz created successfully'))
				close()
				title.value = ''
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
			icon: 'file-text',
		},
		{
			label: __('Total Marks'),
			key: 'total_marks',
			width: 1,
			align: 'center',
			icon: 'hash',
		},
		{
			label: __('Passing Percentage'),
			key: 'passing_percentage',
			width: 1,
			align: 'center',
			icon: 'percent',
		},
		{
			label: __('Max Attempts'),
			key: 'max_attempts',
			width: 1,
			align: 'center',
			icon: 'repeat',
		},
		{
			label: __('Show Answers'),
			key: 'show_answers',
			width: 1,
			align: 'center',
			icon: 'eye',
		},
		{
			label: __('Modified'),
			key: 'modified',
			width: 1,
			align: 'center',
			icon: 'clock',
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
