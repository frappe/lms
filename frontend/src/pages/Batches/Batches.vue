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
			<Dropdown
				v-if="canCreateBatch()"
				:options="[
					{
						label: __('New Batch'),
						icon: 'lucide-users',
						onClick() {
							openFormRoute(router, { name: 'NewBatch' })
						},
					},
					{
						label: __('Import Batch'),
						icon: 'lucide-upload',
						onClick() {
							router.push({
								name: 'NewDataImport',
								params: { doctype: 'LMS Batch' },
							})
						},
					},
				]"
			>
				<template v-slot="{ open }">
					<Button variant="solid">
						<template #prefix>
							<span class="lucide-plus size-4" />
						</template>
						{{ __('Create') }}
						<template #suffix>
							<span
								:class="[
									'lucide-chevron-down ms-1 size-4 transform transition-transform',
									open ? 'rotate-180' : '',
								]"
							/>
						</template>
					</Button>
				</template>
			</Dropdown>
		</template>

		<template #filters>
			<TabButtons
				v-if="batchTabs.length"
				:options="batchTabs"
				v-model="currentTab"
				class="!w-fit shrink-0"
			/>
			<FormControl
				v-model="title"
				:placeholder="__('Search')"
				:aria-label="__('Search')"
				type="text"
				@input="updateBatches()"
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
	Dropdown,
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

const user = inject('$user')
const dayjs = inject('$dayjs')
const { brand } = sessionStore()
const start = ref(0)
const categories = ref([])
const currentCategory = ref(null)
const title = ref('')
const certification = ref(false)
const filters = ref({})
const ADMIN_ROLES = new Set(['is_moderator', 'is_instructor', 'is_evaluator'])
const is_student = computed(() => user.data?.is_student)
const isAdmin = computed(() =>
	Boolean(user.data && [...ADMIN_ROLES].some((role) => user.data[role]))
)
const currentTab = ref(isAdmin.value ? 'active' : 'all')
const orderBy = ref('start_date')
const readOnlyMode = window.read_only_mode
const router = useRouter()

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

// Active, Upcoming and Archived are settled against the current time in Python
// rather than in the query, and `enrolled` is not a field, so only the
// endpoint that resolves both can say how many batches a tab really holds.
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
	if (currentTab.value == 'enrolled') {
		filters.value['enrolled'] = 1
		delete filters.value['start_date']
		delete filters.value['end_date']
		delete filters.value['published']
		orderBy.value = 'start_date desc'
	} else if (isAdmin.value) {
		delete filters.value['enrolled']
		delete filters.value['start_date']
		delete filters.value['end_date']
		delete filters.value['published']
		orderBy.value = 'start_date desc'
		if (currentTab.value == 'active') {
			filters.value['end_date'] = ['>=', dayjs().format('YYYY-MM-DD')]
			filters.value['published'] = 1
			orderBy.value = 'start_date'
		} else if (currentTab.value == 'upcoming') {
			filters.value['start_date'] = ['>=', dayjs().format('YYYY-MM-DD')]
			filters.value['published'] = 1
			orderBy.value = 'start_date'
		} else if (currentTab.value == 'archived') {
			filters.value['start_date'] = ['<=', dayjs().format('YYYY-MM-DD')]
		} else if (currentTab.value == 'unpublished') {
			filters.value['published'] = 0
		}
	} else if (is_student.value) {
		delete filters.value['enrolled']
		delete filters.value['end_date']
	}
}

const updateStudentFilter = () => {
	if (
		!user.data ||
		(is_student.value && !isAdmin.value && currentTab.value != 'enrolled')
	) {
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
	if (!user.data) {
		return []
	}

	const tabs = []
	if (isAdmin.value) {
		tabs.push(
			{ label: __('Active'), value: 'active' },
			{ label: __('Upcoming'), value: 'upcoming' },
			{ label: __('Archived'), value: 'archived' },
			{ label: __('Unpublished'), value: 'unpublished' }
		)
	} else {
		tabs.push({ label: __('All'), value: 'all' })
	}
	if (is_student.value) {
		tabs.push({ label: __('Enrolled'), value: 'enrolled' })
	}
	return tabs
})

// user.data is empty at setup, so currentTab starts as `all`. Staff tabs do
// not include `all`; without this, they keep an unselected tab and an
// unfiltered list after roles land.
watch(batchTabs, (tabs) => {
	if (!tabs.length) return
	if (!tabs.some((tab) => tab.value === currentTab.value)) {
		currentTab.value = tabs[0].value
	}
})

const pageTitle = computed(() => {
	const tab = batchTabs.value.find((t) => t.value === currentTab.value)
	return __('{0} Batches').format(tab?.label || __('All'))
})

const canCreateBatch = () => {
	if (readOnlyMode) return false
	return isAdmin.value
}

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
