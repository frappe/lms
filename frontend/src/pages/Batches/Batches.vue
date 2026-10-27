<template>
	<ListPage
		:breadcrumbs="breadcrumbs"
		:title="pageTitle"
		:rows="batches.data || []"
		:loading="batches.list.loading"
		:total-count="batchCount"
		:has-next-page="batches.hasNextPage"
		v-model:page-length="pageLength"
		empty-name="Batches"
		empty-icon="lucide-users"
		@load-more="batches.next()"
	>
		<template #actions>
			<div v-if="canCreateBatch()" class="flex items-center gap-2">
				<Button variant="subtle" @click="openBatchImport">
					{{ __('Import') }}
				</Button>
				<Button variant="solid" @click="openNewBatch">
					<template #prefix>
						<span class="lucide-plus size-4" />
					</template>
					{{ __('New Batch') }}
				</Button>
			</div>
		</template>

		<template #filters>
			<TabButtons
				v-if="user.data"
				:options="batchTabs"
				v-model="currentTab"
				class="!w-fit shrink-0"
			/>
			<FormControl
				v-model="title"
				:placeholder="__('Search')"
				:aria-label="__('Search')"
				type="text"
			>
				<template #prefix>
					<span class="lucide-search size-4 text-ink-gray-5" />
				</template>
			</FormControl>
			<ClearableCombobox
				v-if="categories.length"
				v-model="currentCategory"
				:options="categories.filter((c) => c.value)"
				:placeholder="__('Category')"
				@update:modelValue="updateBatches()"
			/>
			<ToggleFilter
				:modelValue="certification"
				:label="__('Certification')"
				:mobileLabel="__('Certification available')"
				:tooltip="__('Only show batches that offer a certificate')"
				@update:modelValue="setCertification"
			/>
		</template>

		<template #card="{ row }">
			<router-link
				:to="{ name: 'BatchDetail', params: { batchName: row.name } }"
			>
				<BatchCard :batch="row" />
			</router-link>
		</template>
	</ListPage>

	<router-view />
</template>
<script setup>
import {
	Button,
	createListResource,
	createResource,
	FormControl,
	TabButtons,
	usePageMeta,
} from 'frappe-ui'
import ClearableCombobox from '@/components/Controls/ClearableCombobox.vue'
import ToggleFilter from '@/components/Controls/ToggleFilter.vue'
import { computed, inject, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { sessionStore } from '@/stores/session'
import BatchCard from '@/pages/Batches/components/BatchCard.vue'
import ListPage from '@/components/Layouts/ListPage.vue'
import { openFormRoute } from '@/composables/useFormRoute'
import { setFormSource } from '@/composables/formTracking'

const user = inject('$user')
const dayjs = inject('$dayjs')
const { brand } = sessionStore()
const start = ref(0)
const categories = ref([])
const currentCategory = ref(null)
const title = ref('')
const certification = ref(false)
const filters = ref({})
const is_student = computed(() => user.data?.is_student)
const isAdmin = computed(() =>
	['is_moderator', 'is_instructor', 'is_evaluator'].some(
		(role) => user.data?.[role]
	)
)
const currentTab = ref('upcoming')
const orderBy = ref('start_date')
const readOnlyMode = window.read_only_mode
const router = useRouter()

onMounted(() => {
	setFiltersFromQuery()
	updateBatches()
	// TextInput emits on input and change; watched after query hydration to avoid a refetch.
	watch(title, () => updateBatches())
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
	// `|| false` would keep the raw string, so ?certification=false read as on.
	certification.value = queries.get('certification') === 'true'
}

const batches = createListResource({
	doctype: 'LMS Batch',
	url: 'lms.lms.utils.get_batches',
	cache: ['batches', user.data?.name],
	pageLength: 24,
	start: start.value,
})

const pageLength = computed({
	get: () => batches.pageLength,
	set: (value) => {
		// reload() ignores pageLength while start > 0 and refetches the rows
		// already loaded, so a size change after Load More would do nothing.
		batches.update({ pageLength: value, start: 0 })
		batches.reload()
	},
})

const setCertification = (value) => {
	certification.value = value
	updateBatches()
}

const setCategories = (data) => {
	let allCategories = data.map((batch) => batch.category)
	allCategories = allCategories.filter(
		(category, index) => allCategories.indexOf(category) === index && category
	)
	if (categories.value.length <= allCategories.length) {
		updateCategories(data)
	}
}

// Upcoming and Archived are settled against the current time in Python rather
// than in the query, and `enrolled` is not a field, so only the endpoint that
// resolves both can say how many batches a tab really holds.
const batchCountResource = createResource({
	url: 'lms.lms.utils.get_batch_count',
	makeParams: () => ({ filters: filters.value }),
	onError: (error) => {
		console.error(error)
	},
})

const batchCount = computed(() => batchCountResource.data ?? null)

const updateBatches = () => {
	updateFilters()
	batches.update({
		filters: filters.value,
		orderBy: orderBy.value,
	})
	batches.reload().then((data) => {
		setCategories(data)
	})
	// Nothing orders the responses, so a slow count for a tab the user has
	// left would overwrite the current one.
	batchCountResource.abort()
	batchCountResource.submit()
}

const updateFilters = () => {
	updateCategoryFilter()
	updateTitleFilter()
	updateCertificationFilter()
	updateTabFilter()
	updateStudentFilter()
	setQueryParams()
}

const updateCategoryFilter = () => {
	if (currentCategory.value) {
		filters.value['category'] = currentCategory.value
	} else {
		delete filters.value['category']
	}
}

const updateTitleFilter = () => {
	if (title.value) {
		filters.value['title'] = ['like', `%${title.value}%`]
	} else {
		delete filters.value['title']
	}
}

const updateCertificationFilter = () => {
	if (certification.value) {
		filters.value['certification'] = 1
	} else {
		delete filters.value['certification']
	}
}

const updateTabFilter = () => {
	orderBy.value = 'start_date'
	if (!user.data) {
		return
	}
	if (currentTab.value == 'enrolled' && is_student.value) {
		filters.value['enrolled'] = 1
		delete filters.value['start_date']
		delete filters.value['end_date']
		delete filters.value['published']
		orderBy.value = 'start_date desc'
	} else if (is_student.value) {
		delete filters.value['enrolled']
	} else {
		delete filters.value['start_date']
		delete filters.value['published']
		orderBy.value = 'start_date desc'
		if (currentTab.value == 'upcoming') {
			filters.value['start_date'] = ['>=', dayjs().format('YYYY-MM-DD')]
			filters.value['published'] = 1
			orderBy.value = 'start_date'
		} else if (currentTab.value == 'archived') {
			filters.value['start_date'] = ['<=', dayjs().format('YYYY-MM-DD')]
		} else if (currentTab.value == 'unpublished') {
			filters.value['published'] = 0
		}
	}
}

// Learners and guests are shown only batches they can still join. A start_date
// filter makes get_batches treat the list as upcoming, which also drops today's
// batches whose start time has passed.
const updateStudentFilter = () => {
	if (!isAdmin.value && currentTab.value != 'enrolled') {
		delete filters.value['end_date']
		filters.value['start_date'] = ['>=', dayjs().format('YYYY-MM-DD')]
		filters.value['published'] = 1
	}
}

const setQueryParams = () => {
	let queries = new URLSearchParams(location.search)
	let filterKeys = {
		title: title.value,
		category: currentCategory.value,
		certification: certification.value,
	}

	Object.keys(filterKeys).forEach((key) => {
		if (filterKeys[key]) {
			queries.set(key, filterKeys[key])
		} else {
			queries.delete(key)
		}
	})

	history.replaceState(
		{},
		'',
		`${location.pathname}${queries.size > 0 ? `?${queries.toString()}` : ''}`
	)
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

const batchTabs = computed(() => {
	if (isAdmin.value) {
		return [
			{ label: __('All'), value: 'all' },
			{ label: __('Upcoming'), value: 'upcoming' },
			{ label: __('Archived'), value: 'archived' },
			{ label: __('Unpublished'), value: 'unpublished' },
		]
	}
	const tabs = [{ label: __('Upcoming'), value: 'upcoming' }]
	if (user.data) {
		tabs.push({ label: __('Enrolled'), value: 'enrolled' })
	}
	return tabs
})

const pageTitle = computed(() => {
	const tab = batchTabs.value.find((t) => t.value === currentTab.value)
	return __('{0} Batches').format(tab?.label)
})

const canCreateBatch = () => {
	if (readOnlyMode) return false
	return Boolean(user.data?.is_moderator || user.data?.is_evaluator)
}

// openFormRoute, not a bare router.push: it stamps the history entry so the
// form's own close() pops it instead of replacing.
const openNewBatch = () => {
	setFormSource('header_button')
	openFormRoute(router, { name: 'NewBatch' })
}
const openBatchImport = () =>
	router.push({ name: 'NewDataImport', params: { doctype: 'LMS Batch' } })

const breadcrumbs = computed(() => [
	{
		label: __('Batches'),
		route: { name: 'Batches' },
	},
])

usePageMeta(() => {
	return {
		title: __('Batches'),
		icon: brand.favicon,
	}
})
</script>
