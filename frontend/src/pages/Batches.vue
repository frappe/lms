<template>
	<header
		class="sticky flex items-center justify-between top-0 z-10 border-b bg-white px-3 py-2.5 sm:px-5"
	>
		<Breadcrumbs :items="breadcrumbs" />
		<router-link
			v-if="user.data?.is_moderator"
			:to="{
				name: 'BatchForm',
				params: { batchName: 'new' },
			}"
		>
			<Button variant="solid">
				<template #prefix>
					<Plus class="h-4 w-4 stroke-1.5" />
				</template>
				{{ __('New') }}
			</Button>
		</router-link>
	</header>
	<div class="p-5 pb-10">
		<div class="flex items-center justify-between mb-5">
			<div class="text-lg font-semibold">
				{{ __('All Batches') }}
			</div>
			<div class="flex items-center space-x-2">
				<TabButtons
					v-if="user.data && user.data?.is_student"
					:buttons="batchTabs"
					v-model="currentTab"
				/>
				<FormControl
					v-model="title"
					:placeholder="__('Search by Title')"
					type="text"
					@input="updateBatches()"
				/>
				<div v-if="user.data && !user.data?.is_student" class="w-44">
					<Select
						v-model="currentDuration"
						:options="batchType"
						:placeholder="__('Type')"
						@change="updateBatches()"
					/>
				</div>
				<div class="w-44">
					<Select
						v-if="categories.length"
						v-model="currentCategory"
						:options="categories"
						:placeholder="__('Category')"
						@change="updateBatches()"
					/>
				</div>
			</div>
		</div>
		<div v-if="batches.data?.length" class="grid grid-cols-4 gap-5">
			<router-link
				v-for="batch in batches.data"
				:to="{ name: 'BatchDetail', params: { batchName: batch.name } }"
			>
				<BatchCard :batch="batch" />
			</router-link>
		</div>
		<div
			v-else
			class="flex flex-col items-center justify-center text-sm text-gray-600 italic mt-48"
		>
			<BookOpen class="size-10 mx-auto stroke-1.5 text-gray-500" />
			<div class="text-xl font-medium mb-2">
				{{ __('No batches found') }}
			</div>
			<div class="leading-5 w-2/5 text-center">
				{{
					__(
						'There are no batches matching the criteria. Keep an eye out, fresh learning experiences are on the way soon!'
					)
				}}
			</div>
		</div>
		<div
			v-if="!batches.loading && batches.hasNextPage"
			class="flex justify-center mt-5"
		>
			<Button @click="batches.next()">
				{{ __('Load More') }}
			</Button>
		</div>
	</div>
</template>
<script setup>
import {
	Breadcrumbs,
	Button,
	createListResource,
	FormControl,
	Select,
	TabButtons,
} from 'frappe-ui'
import { computed, inject, onMounted, ref, watch } from 'vue'
import { BookOpen, Plus } from 'lucide-vue-next'
import BatchCard from '@/components/BatchCard.vue'

const user = inject('$user')
const dayjs = inject('$dayjs')
const start = ref(0)
const pageLength = ref(20)
const categories = ref([])
const currentCategory = ref(null)
const title = ref('')
const filters = ref({})
const currentDuration = ref(null)
const currentTab = ref('All')

onMounted(() => {
	setFiltersFromQuery()
	updateBatches()
	categories.value = [
		{
			label: '',
			value: null,
		},
	]
})

const setFiltersFromQuery = () => {
	let queries = new URLSearchParams(location.search)
	title.value = queries.get('title') || ''
	currentCategory.value = queries.get('category') || null
	currentDuration.value = queries.get('type') || null
}

const batches = createListResource({
	doctype: 'LMS Batch',
	url: 'lms.lms.utils.get_batches',
	cache: ['batches', user.data?.name],
	pageLength: pageLength.value,
	start: start.value,
	onSuccess(data) {
		let allCategories = data.map((batch) => batch.category)
		allCategories = allCategories.filter(
			(category, index) => allCategories.indexOf(category) === index && category
		)
		if (categories.value.length <= allCategories.length) {
			updateCategories(data)
		}
	},
})

const updateBatches = () => {
	updateFilters()
	batches.update({
		filters: filters.value,
	})
	batches.reload()
}

const updateFilters = () => {
	if (currentCategory.value) {
		filters.value['category'] = currentCategory.value
	} else {
		delete filters.value['category']
	}

	if (title.value) {
		filters.value['title'] = ['like', `%${title.value}%`]
	} else {
		delete filters.value['title']
	}

	if (currentDuration.value) {
		delete filters.value['start_date']
		delete filters.value['published']

		if (currentDuration.value == 'Upcoming') {
			filters.value['start_date'] = ['>=', dayjs().format('YYYY-MM-DD')]
		} else if (currentDuration.value == 'Archived') {
			filters.value['start_date'] = ['<', dayjs().format('YYYY-MM-DD')]
		} else if (currentDuration.value == 'Unpublished') {
			filters.value['published'] = 0
		}
	} else {
		delete filters.value['start_date']
		delete filters.value['published']
	}

	if (currentTab.value == 'Enrolled' && user.data?.is_student) {
		filters.value['enrolled'] = 1
	} else {
		delete filters.value['enrolled']
	}

	if (!user.data || user.data?.is_student) {
		filters.value['start_date'] = ['>=', dayjs().format('YYYY-MM-DD')]
		filters.value['published'] = 1
	}

	setQueryParams()
}

const setQueryParams = () => {
	let queries = new URLSearchParams(location.search)
	let filterKeys = {
		title: title.value,
		category: currentCategory.value,
		type: currentDuration.value,
	}

	Object.keys(filterKeys).forEach((key) => {
		if (filterKeys[key]) {
			queries.set(key, filterKeys[key])
		} else {
			queries.delete(key)
		}
	})

	history.replaceState({}, '', `${location.pathname}?${queries.toString()}`)
}

const updateCategories = (data) => {
	data.forEach((batch) => {
		if (
			batch.category &&
			!categories.value.find((category) => category.value === batch.category)
		)
			categories.value.push({
				label: batch.category,
				value: batch.category,
			})
	})
}

watch(currentTab, () => {
	updateBatches()
})

const batchType = computed(() => {
	let types = [
		{ label: __(''), value: null },
		{ label: __('Upcoming'), value: 'Upcoming' },
		{ label: __('Archived'), value: 'Archived' },
	]
	if (user.data?.is_moderator) {
		types.push({ label: __('Unpublished'), value: 'Unpublished' })
	}
	return types
})

const batchTabs = computed(() => {
	let tabs = [
		{
			label: __('All'),
		},
		{
			label: __('Enrolled'),
		},
	]
	return tabs
})

const breadcrumbs = computed(() => [
	{
		label: __('Batches'),
		route: { name: 'Batches' },
	},
])
</script>
