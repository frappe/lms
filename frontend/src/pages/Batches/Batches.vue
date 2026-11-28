<template>
	<ListPage
		:breadcrumbs="breadcrumbs"
		:rows="batches.data || []"
		:loading="batches.list.loading"
		:total-count="batchCount"
		:has-next-page="batches.hasNextPage"
		v-model:page-length="pageLength"
		:empty-name="__('Batches')"
		empty-icon="lucide-users"
		:empty-title="emptyState?.title"
		:empty-description="emptyState?.description"
		:search-query="title"
		:filtered="Boolean(currentCategory || activeFilterCount)"
		@load-more="batches.next()"
		@clear-filters="clearFilters"
	>
		<template #actions>
			<div v-if="canCreateBatch()" class="flex items-center gap-2">
				<Button variant="outline" @click="openBatchImport">
					<template #prefix>
						<span class="lucide-upload size-4" />
					</template>
					{{ __('Import') }}
				</Button>
				<Button variant="solid" @click="openNewBatch">
					<template #prefix>
						<span class="lucide-plus size-4" />
					</template>
					{{ __('New batch') }}
				</Button>
			</div>
		</template>

		<template #toolbar>
			<div class="space-y-3 px-5 pb-5 pt-4">
				<!-- Below @2xl the status tabs take a row of their own and scroll inside it. -->
				<div class="flex flex-wrap items-center gap-2">
					<FormControl
						v-model="title"
						type="text"
						class="min-w-0 flex-1 @2xl:max-w-sm"
						:placeholder="__('Search batches')"
						:aria-label="__('Search batches')"
					>
						<template #prefix>
							<span class="lucide-search size-4 text-ink-gray-5" />
						</template>
					</FormControl>
					<span class="hidden flex-1 @2xl:block" />
					<div
						v-if="user.data"
						class="order-last w-full overflow-x-auto @2xl:order-none @2xl:w-auto"
					>
						<TabButtons
							v-model="currentTab"
							:options="batchTabs"
							class="!w-fit shrink-0"
							data-testid="status-tabs"
						/>
					</div>
					<Button
						:variant="showFilters ? 'outline' : 'subtle'"
						:aria-expanded="showFilters"
						data-testid="filters-button"
						@click="showFilters = !showFilters"
					>
						<template #prefix>
							<span class="lucide-list-filter size-4" />
						</template>
						{{ __('Filters') }}
						<template v-if="activeFilterCount" #suffix>
							<Badge :label="String(activeFilterCount)" />
						</template>
					</Button>
				</div>

				<div v-if="showFilters" class="flex flex-wrap items-center gap-2">
					<FilterSelect
						v-model="price"
						:label="__('Price')"
						icon="lucide-tag"
						:options="priceOptions"
					/>
					<FilterSelect
						v-model="medium"
						:label="__('Mode')"
						icon="lucide-map-pin"
						:options="mediumOptions"
					/>
					<FilterSelect
						v-model="certification"
						data-testid="certification-chip"
						:label="__('Certification')"
						icon="lucide-circle-check"
						:empty-value="false"
					/>
					<Button
						v-if="activeFilterCount"
						variant="ghost"
						@click="clearFilters"
					>
						{{ __('Clear filters') }}
					</Button>
				</div>
				<ChipsSkeleton
					v-if="categories.list.loading && !categories.data"
					data-testid="category-skeleton"
				/>
				<CategoryChips
					v-else-if="categoryOptions.length"
					v-model="currentCategory"
					:options="categoryOptions"
				/>
			</div>
		</template>

		<template v-if="emptyState" #empty-actions>
			<EmptyStateActions
				list="batches"
				:tab="currentTab"
				:create-label="__('New Batch')"
				docs="https://docs.frappe.io/learning/create-a-batch"
				@create="newBatchFromEmptyState"
			/>
		</template>

		<template #card-skeleton>
			<BatchCardSkeleton />
		</template>

		<template #card="{ row }">
			<BatchCard
				:batch="row"
				:to="{ name: 'BatchDetail', params: { batchName: row.name } }"
			/>
		</template>
	</ListPage>

	<router-view />
</template>
<script setup>
import CategoryChips from '@/components/CategoryChips.vue'
import {
	Badge,
	Button,
	createListResource,
	createResource,
	FormControl,
	TabButtons,
	usePageMeta,
} from 'frappe-ui'
import FilterSelect from '@/components/Controls/FilterSelect.vue'
import { computed, inject, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { sessionStore } from '@/stores/session'
import BatchCard from '@/pages/Batches/components/BatchCard.vue'
import BatchCardSkeleton from '@/components/Skeletons/BatchCardSkeleton.vue'
import ChipsSkeleton from '@/components/Skeletons/ChipsSkeleton.vue'
import ListPage from '@/components/Layouts/pages/ListPage.vue'
import { setFormSource } from '@/composables/formTracking'
import { useFlowChanges } from '@/composables/useFlowChanges'
import EmptyStateActions from '@/components/EmptyStateActions.vue'

const user = inject('$user')
const dayjs = inject('$dayjs')
const { brand } = sessionStore()
const start = ref(0)
const currentCategory = ref(null)
const title = ref('')
const certification = ref(false)
const price = ref('')
const medium = ref('')
const showFilters = ref(false)
const filters = ref({})
const priceOptions = [
	{ label: __('Any price'), value: '' },
	{ label: __('Free'), value: 'free' },
	{ label: __('Paid'), value: 'paid' },
]
const mediumOptions = [
	{ label: __('Any mode'), value: '' },
	{ label: __('Online'), value: 'Online' },
	{ label: __('In person'), value: 'Offline' },
]
const isAdmin = computed(() =>
	['is_moderator', 'is_instructor', 'is_evaluator'].some(
		(role) => user.data?.[role]
	)
)
// A signed-in learner most often comes back for a batch they are in, and a
// batch that has started is no longer under Upcoming.
const currentTab = ref(
	isAdmin.value ? 'upcoming' : user.data ? 'enrolled' : 'upcoming'
)
const orderBy = ref('start_date')
const readOnlyMode = window.read_only_mode
const router = useRouter()

onMounted(() => {
	setFiltersFromQuery()
	showFilters.value = Boolean(activeFilterCount.value)
	updateBatches()
	// TextInput emits on input and change; watched after query hydration to avoid a refetch.
	watch([title, currentCategory, certification, price, medium], () =>
		updateBatches()
	)
})

const setFiltersFromQuery = () => {
	let queries = new URLSearchParams(location.search)
	title.value = queries.get('title') || ''
	currentCategory.value = queries.get('category') || null
	// `|| false` would keep the raw string, so ?certification=false read as on.
	certification.value = queries.get('certification') === 'true'
	price.value = ['free', 'paid'].includes(queries.get('price'))
		? queries.get('price')
		: ''
	medium.value = ['Online', 'Offline'].includes(queries.get('mode'))
		? queries.get('mode')
		: ''
}

const activeFilterCount = computed(
	() => [price.value, medium.value, certification.value].filter(Boolean).length
)

// Every published batch's category, fetched beside the list rather than read
// off whichever rows it has loaded, so the chips are complete and come first.
const categories = createListResource({
	doctype: 'LMS Batch',
	url: 'lms.lms.utils.get_batch_categories',
	cache: ['batch_categories'],
	auto: true,
})

const categoryOptions = computed(() =>
	(categories.data || []).filter((category) => category.value)
)

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

useFlowChanges({
	doctypes: ['LMS Batch'],
	reload: () => {
		batches.reload()
		batchCountResource.reload()
	},
})

// The watcher refetches once for however many of these change together.
const clearFilters = () => {
	currentCategory.value = null
	certification.value = false
	price.value = ''
	medium.value = ''
	title.value = ''
}

const updateBatches = () => {
	updateFilters()
	batches.update({
		filters: filters.value,
		orderBy: orderBy.value,
	})
	batches.reload()
	// Nothing orders the responses, so a slow count for a tab the user has
	// left would overwrite the current one.
	batchCountResource.abort()
	batchCountResource.submit()
}

const updateFilters = () => {
	updateCategoryFilter()
	updateTitleFilter()
	updateCertificationFilter()
	updatePriceAndModeFilters()
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

const updatePriceAndModeFilters = () => {
	if (price.value) filters.value['paid_batch'] = Number(price.value === 'paid')
	else delete filters.value['paid_batch']
	if (medium.value) filters.value['medium'] = medium.value
	else delete filters.value['medium']
}

// Upcoming, In progress and Completed are settled to the day here; the server
// settles the time of day from these same filter shapes.
const staffTabFilters = () => {
	const today = dayjs().format('YYYY-MM-DD')
	return {
		upcoming: {
			filters: { start_date: ['>=', today], published: 1 },
			orderBy: 'start_date',
		},
		active: {
			filters: {
				start_date: ['<=', today],
				end_date: ['>=', today],
				published: 1,
			},
			orderBy: 'start_date',
		},
		completed: { filters: { end_date: ['<', today] } },
		unpublished: { filters: { published: 0 } },
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
		const tab = staffTabFilters()[currentTab.value]
		Object.assign(filters.value, tab?.filters)
		orderBy.value = tab?.orderBy || 'start_date desc'
	} else {
		delete filters.value['enrolled']
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
		price: price.value,
		mode: medium.value,
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

watch(currentTab, () => {
	updateBatches()
})

const batchTabs = computed(() => {
	if (isAdmin.value) {
		return [
			{ label: __('Upcoming'), value: 'upcoming' },
			{ label: __('In progress'), value: 'active' },
			{ label: __('Completed'), value: 'completed' },
			{ label: __('Drafts'), value: 'unpublished' },
		]
	}
	const tabs = [
		{ label: __('Upcoming'), title: __('Upcoming Batches'), value: 'upcoming' },
	]
	if (user.data) {
		tabs.push({
			label: __('Enrolled'),
			title: __('Enrolled Batches'),
			value: 'enrolled',
		})
	}
	return tabs
})

// Roles can land after setup, leaving staff on `enrolled`, which they have no tab for.
watch(batchTabs, (tabs) => {
	if (!tabs.some((tab) => tab.value === currentTab.value)) {
		currentTab.value = tabs[0].value
	}
})

const canCreateBatch = () => {
	if (readOnlyMode) return false
	return Boolean(user.data?.is_moderator || user.data?.is_evaluator)
}

const openNewBatch = () => {
	setFormSource('header_button')
	router.push({ name: 'NewBatch' })
}
// A new site's batch tabs are all empty, and the learner wording ("fresh
// learning experiences are on the way") tells the person who would create
// them nothing. Each tab says what lands there and how to start one.
const emptyState = computed(() => {
	if (!canCreateBatch()) return null
	switch (currentTab.value) {
		case 'active':
			return {
				title: __('Teach people together in a batch'),
				description: __(
					'Take a group through your courses on a schedule, with live classes and a certificate at the end.'
				),
			}
		case 'upcoming':
			return {
				title: __('No upcoming batches'),
				description: __(
					'Published batches that start later show up here, so you can open sign-ups early.'
				),
			}
		case 'completed':
			return {
				title: __('No completed batches'),
				description: __(
					'Batches move here once they end, so you can look back at each group.'
				),
			}
		case 'unpublished':
			return {
				title: __('No unpublished batches'),
				description: __(
					'New batches wait here until you publish them, so learners never see a half-ready batch.'
				),
			}
		default:
			return null
	}
})

function newBatchFromEmptyState() {
	setFormSource('empty_state')
	router.push({ name: 'NewBatch' })
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
