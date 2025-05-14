<template>
	<header
		class="sticky top-0 z-10 flex items-center justify-between border-b bg-surface-white px-3 py-2.5 sm:px-5"
	>
		<Breadcrumbs :items="breadcrumbs" />
		<router-link
			v-if="!readOnlyMode"
			:to="{
				name: 'QuizForm',
				params: {
					quizID: 'new',
				},
			}"
		>
			<Button variant="solid">
				<template #prefix>
					<Plus class="w-4 h-4" />
				</template>
				{{ __('New Quiz') }}
			</Button>
		</router-link>
	</header>
	<div v-if="quizzes.data?.length" class="md:w-3/4 md:mx-auto py-5 mx-5">
		<div v-if="quizCount" class="text-xl font-semibold text-ink-gray-7 mb-4">
			{{ __('{0} Quizzes').format(quizCount) }}
		</div>
		<ListView
			:columns="quizColumns"
			:rows="quizzes.data"
			row-key="name"
			:options="{ showTooltip: false, selectable: false }"
		>
			<ListHeader
				class="mb-2 grid items-center space-x-4 rounded bg-surface-gray-2 p-2"
			>
				<ListHeaderItem :item="item" v-for="item in quizColumns">
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
					<ListRow :row="row" />
				</router-link>
			</ListRows>
		</ListView>
		<div class="flex justify-center my-5">
			<Button v-if="quizzes.hasNextPage" @click="quizzes.next()">
				{{ __('Load More') }}
			</Button>
		</div>
	</div>
	<EmptyState v-else type="Quizzes" />
</template>
<script setup>
import {
	Breadcrumbs,
	Button,
	call,
	createListResource,
	ListView,
	ListRows,
	ListRow,
	ListHeader,
	ListHeaderItem,
	usePageMeta,
} from 'frappe-ui'
import { useRouter } from 'vue-router'
import { computed, inject, onMounted, ref } from 'vue'
import { Plus } from 'lucide-vue-next'
import { sessionStore } from '@/stores/session'
import EmptyState from '@/components/EmptyState.vue'

const { brand } = sessionStore()
const user = inject('$user')
const router = useRouter()
const quizCount = ref(0)
const readOnlyMode = window.read_only_mode

onMounted(() => {
	if (!user.data?.is_moderator && !user.data?.is_instructor) {
		router.push({ name: 'Courses' })
	}
	getQuizCount()
})

const quizFilter = computed(() => {
	if (user.data?.is_moderator) return {}
	return {
		owner: user.data?.name,
	}
})

const quizzes = createListResource({
	doctype: 'LMS Quiz',
	filters: quizFilter,
	fields: ['name', 'title', 'passing_percentage', 'total_marks'],
	auto: true,
	cache: ['quizzes', user.data?.name],
	orderBy: 'modified desc',
})

const getQuizCount = () => {
	call('frappe.client.get_count', {
		doctype: 'LMS Quiz',
	}).then((data) => {
		quizCount.value = data
	})
}

const quizColumns = computed(() => {
	return [
		{
			label: __('Title'),
			key: 'title',
			width: 2,
		},
		{
			label: __('Total Marks'),
			key: 'total_marks',
			width: 1,
			align: 'center',
		},
		{
			label: __('Passing Percentage'),
			key: 'passing_percentage',
			width: 1,
			align: 'center',
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
