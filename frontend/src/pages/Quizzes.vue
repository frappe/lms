<template>
	<header
		class="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-3 py-2.5 sm:px-5"
	>
		<Breadcrumbs :items="breadcrumbs" />
		<router-link
			:to="{
				name: 'QuizCreation',
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
	<div v-if="quizzes.data?.length" class="w-3/4 mx-auto py-5">
		<ListView
			:columns="quizColumns"
			:rows="quizzes.data"
			row-key="name"
			:options="{ showTooltip: false, selectable: false }"
		>
			<ListHeader
				class="mb-2 grid items-center space-x-4 rounded bg-gray-100 p-2"
			>
				<ListHeaderItem :item="item" v-for="item in quizColumns">
				</ListHeaderItem>
			</ListHeader>
			<ListRows>
				<router-link
					v-for="row in quizzes.data"
					:to="{
						name: 'QuizCreation',
						params: {
							quizID: row.name,
						},
					}"
				>
					<ListRow :row="row" />
				</router-link>
			</ListRows>
		</ListView>
	</div>
</template>
<script setup>
import {
	Breadcrumbs,
	createListResource,
	ListView,
	ListRows,
	ListRow,
	ListHeader,
	ListHeaderItem,
	Button,
} from 'frappe-ui'
import { useRouter } from 'vue-router'
import { computed, inject, onMounted } from 'vue'
import { Plus } from 'lucide-vue-next'

const user = inject('$user')
const router = useRouter()

onMounted(() => {
	if (!user.data?.is_moderator && !user.data?.is_instructor) {
		router.push({ name: 'Courses' })
	}
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
	onSuccess(data) {
		data.forEach((row) => {})
	},
})

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
</script>
