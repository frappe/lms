<template>
	<ListPage
		:breadcrumbs="breadcrumbs"
		:rows="courses.data || []"
		:loading="courses.list.loading || reloading"
		:total-count="courseCount"
		:has-next-page="courses.hasNextPage"
		v-model:page-length="pageLength"
		:empty-name="__('Courses')"
		empty-icon="lucide-book-open"
		:empty-title="emptyState?.title"
		:empty-description="emptyState?.description"
		:search-query="title"
		:filtered="Boolean(currentCategory || activeFilterCount)"
		@load-more="courses.next()"
		@clear-filters="clearFilters"
	>
		<template v-if="emptyState" #empty-actions>
			<EmptyStateActions
				list="courses"
				:tab="currentTab"
				:create-label="__('New Course')"
				docs="https://docs.frappe.io/learning/create-a-course"
				@create="newCourseFromEmptyState"
			/>
		</template>

		<template #actions>
			<div v-if="canCreateCourse()" class="flex items-center gap-2">
				<Dropdown
					align="end"
					side="bottom"
					:options="importMenu"
					@update:open="(open) => open && capture('course_import_menu_opened')"
				>
					<Button variant="outline">
						<template #prefix>
							<span class="lucide-upload size-4" />
						</template>
						{{ __('Import') }}
					</Button>
				</Dropdown>
				<Button variant="solid" @click="openNewCourse">
					<template #prefix>
						<span class="lucide-plus size-4" />
					</template>
					{{ __('New course') }}
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
						:placeholder="__('Search courses')"
						:aria-label="__('Search courses')"
					>
						<template #prefix>
							<span class="lucide-search size-4 text-ink-gray-5" />
						</template>
					</FormControl>
					<span class="hidden flex-1 @2xl:block" />
					<div
						class="order-last w-full overflow-x-auto @2xl:order-none @2xl:w-auto"
					>
						<TabButtons
							v-model="currentTab"
							:options="courseTabs"
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
					<Dropdown :options="sortMenu">
						<Button variant="subtle" data-testid="sort-button">
							<template #prefix>
								<span class="lucide-arrow-down-up size-4" />
							</template>
							{{ sortLabel }}
						</Button>
					</Dropdown>
					<FilterSelect
						v-model="price"
						:label="__('Price')"
						icon="lucide-tag"
						:options="priceOptions"
					/>
					<FilterSelect
						v-model="certification"
						data-testid="certification-chip"
						:label="__('Certification')"
						icon="lucide-circle-check"
						:empty-value="false"
					/>
					<FilterSelect
						v-model="rating"
						:label="__('Rating')"
						icon="lucide-star"
						:options="ratingOptions"
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

		<template #card-skeleton>
			<CourseCardSkeleton />
		</template>

		<template #card="{ row }">
			<CourseCard
				:course="row"
				:to="{ name: 'CourseDetail', params: { courseName: row.name } }"
			/>
		</template>

		<template #after>
			<section
				v-if="
					currentTab === 'live' &&
					upcomingCourses.loading &&
					!upcomingCourses.data
				"
				class="px-5 pb-5 motion-safe:animate-pulse"
				aria-hidden="true"
				data-testid="coming-soon-skeleton"
			>
				<SkeletonText
					text="text-lg-semibold"
					width="w-32"
					class="mb-3 w-32"
					strong
				/>
				<div
					class="grid grid-cols-1 @2xl:grid-cols-2 @4xl:grid-cols-3 @7xl:grid-cols-4 gap-5"
				>
					<CourseCardSkeleton v-for="i in 4" :key="i" />
				</div>
			</section>
			<section
				v-else-if="currentTab === 'live' && upcomingCourses.data?.length"
				class="px-5 pb-5"
				data-testid="coming-soon"
			>
				<h2 class="mb-3 text-lg-semibold text-ink-gray-9">
					{{ __('Coming soon') }}
				</h2>
				<div
					class="grid grid-cols-1 @2xl:grid-cols-2 @4xl:grid-cols-3 @7xl:grid-cols-4 gap-5"
				>
					<CourseCard
						v-for="course in upcomingCourses.data"
						:key="course.name"
						:course="course"
						:to="{ name: 'CourseDetail', params: { courseName: course.name } }"
					/>
				</div>
			</section>
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
	Dropdown,
	FormControl,
	TabButtons,
	usePageMeta,
} from 'frappe-ui'
import FilterSelect from '@/components/Controls/FilterSelect.vue'
import ListPage from '@/components/Layouts/pages/ListPage.vue'
import EmptyStateActions from '@/components/EmptyStateActions.vue'
import { computed, inject, onMounted, ref, watch } from 'vue'
import { sessionStore } from '@/stores/session'
import { canCreateCourse } from '@/utils'
import CourseCard from '@/components/CourseCard.vue'
import ChipsSkeleton from '@/components/Skeletons/ChipsSkeleton.vue'
import CourseCardSkeleton from '@/components/Skeletons/CourseCardSkeleton.vue'
import SkeletonText from '@/components/Skeletons/SkeletonText.vue'
import { useRouter } from 'vue-router'
import { openFormRoute } from '@/composables/useFormRoute'
import { setFormSource } from '@/composables/formTracking'
import { useFlowChanges } from '@/composables/useFlowChanges'
import { useTelemetry } from '@framework/ui/telemetry/index'

const user = inject('$user')
const dayjs = inject('$dayjs')
const start = ref(0)
const currentCategory = ref(null)
const title = ref('')
const certification = ref(false)
const price = ref('')
const rating = ref('')
const sort = ref('popular')
const filters = ref({})
const currentTab = ref('live')
const { brand } = sessionStore()
const router = useRouter()
const showFilters = ref(false)

const sortOptions = [
	{ label: __('Most popular'), value: 'popular', orderBy: 'enrollments desc' },
	{ label: __('Highest rated'), value: 'rating', orderBy: 'rating desc' },
	{ label: __('Newest'), value: 'newest', orderBy: 'published_on desc' },
	{ label: __('A to Z'), value: 'title', orderBy: 'title asc' },
]
const priceOptions = [
	{ label: __('Any price'), value: '' },
	{ label: __('Free'), value: 'free' },
	{ label: __('Paid'), value: 'paid' },
]
// `rating` is a text field; one-decimal strings compare correctly against it.
const ratingOptions = [
	{ label: __('Any rating'), value: '' },
	...['4.5', '4', '3.5'].map((value) => ({
		label: __('{0} and up').format(value),
		value,
	})),
]

onMounted(() => {
	setFiltersFromQuery()
	showFilters.value = Boolean(
		activeFilterCount.value || sort.value !== 'popular'
	)
	updateCourses()
	// Watched after query hydration so the hydration itself does not refetch.
	watch(
		[title, currentCategory, certification, price, rating, sort, currentTab],
		updateCourses
	)
})

const optionValue = (options, value, fallback) =>
	options.some((option) => option.value === value) ? value : fallback

const setFiltersFromQuery = () => {
	let queries = new URLSearchParams(location.search)
	title.value = queries.get('title') || ''
	currentCategory.value = queries.get('category') || null
	// `|| false` would keep the raw string, so ?certification=false read as on.
	certification.value = queries.get('certification') === 'true'
	price.value = optionValue(priceOptions, queries.get('price'), '')
	rating.value = optionValue(ratingOptions, queries.get('rating'), '')
	sort.value = optionValue(sortOptions, queries.get('sort'), 'popular')
	const tab = queries.get('tab')
	if (tab) currentTab.value = tab
	// Compatibility shim: ?newCourse=1 was this page's ad-hoc deep link before
	// /courses/new existed. BatchCourseModal.vue:27 still emits it, as may
	// bookmarks and anything outside the SPA, so forward it rather than drop it.
	// replace(), so the query-param URL is not left behind as an entry the user
	// can go Back to and re-open the form from.
	if (queries.get('newCourse') == '1') {
		router.replace({ name: 'NewCourse' })
	}
}

const courses = createListResource({
	doctype: 'LMS Course',
	url: 'lms.lms.utils.get_courses',
	cache: ['courses', user.data?.name],
	pageLength: 24,
	start: start.value,
})

// The tabs filter on `enrolled`, `created` and `live`, which are not fields,
// so `frappe.client.get_count` cannot answer this; only the endpoint that
// resolves them can. Without it the footer can say how many rows it has but
// not how many there are.
const courseCountResource = createResource({
	url: 'lms.lms.utils.get_course_count',
	makeParams: () => ({ filters: filters.value }),
	onError: (error) => {
		console.error(error)
	},
})

const upcomingCourses = createResource({
	url: 'lms.lms.utils.get_courses',
	makeParams: () => ({
		filters: { ...fieldFilters(), published: 1, upcoming: 1 },
		limit_page_length: 12,
	}),
})

// Upcoming courses get their own section under the live ones.
const loadUpcomingCourses = () => {
	upcomingCourses.abort()
	if (currentTab.value === 'live') upcomingCourses.submit()
}

const fieldFilters = () => {
	const { category, title, certification, paid_course, rating } = filters.value
	return Object.fromEntries(
		Object.entries({
			category,
			title,
			certification,
			paid_course,
			rating,
		}).filter(([, value]) => value !== undefined)
	)
}

const courseCount = computed(() => courseCountResource.data ?? null)

const getCourseCount = () => {
	// Same sequencing hazard as the list: nothing orders the responses, so a
	// slow count for filters the user has left would overwrite the current one.
	courseCountResource.abort()
	courseCountResource.submit()
}

// `list.loading` goes false mid-request: the aborted fetch's tail resolves
// after the new reload() has started and clears the flag for it, so the empty
// state flashes until the reload lands.
const reloading = ref(false)

const reloadCourses = async () => {
	reloading.value = true
	try {
		await courses.reload()
	} finally {
		reloading.value = false
	}
}

useFlowChanges({
	doctypes: ['LMS Course'],
	reload: () => {
		reloadCourses()
		courseCountResource.reload()
	},
})

const pageLength = computed({
	get: () => courses.pageLength,
	set: (value) => {
		// reload() refetches only the rows already loaded when start > 0, so
		// without rewinding to the first page a bigger page size changes nothing.
		courses.update({ pageLength: value, start: 0 })
		reloadCourses()
	},
})

const categories = createListResource({
	doctype: 'LMS Category',
	url: 'lms.lms.utils.get_course_categories',
	cache: ['course_categories'],
	auto: true,
})

const categoryOptions = computed(() =>
	(categories.data || []).filter((category) => category.value)
)

const activeFilterCount = computed(
	() => [price.value, certification.value, rating.value].filter(Boolean).length
)

const sortLabel = computed(
	() => sortOptions.find((option) => option.value === sort.value).label
)

const sortMenu = computed(() =>
	sortOptions.map((option) => ({
		label: option.label,
		icon: option.value === sort.value ? 'lucide-check' : undefined,
		onClick: () => (sort.value = option.value),
	}))
)

// The watcher refetches once for however many of these change together.
const clearFilters = () => {
	currentCategory.value = null
	certification.value = false
	price.value = ''
	rating.value = ''
	title.value = ''
}

const updateCourses = () => {
	updateFilters()
	// createResource keeps no request sequence: every response assigns
	// `data`, so a slow fetch for filters the user has already left repaints
	// the list with the wrong courses seconds later. Cancel it first: an
	// aborted fetch is swallowed and never reaches the list.
	courses.list.abort()
	courses.update({
		filters: filters.value,
		orderBy: sortOptions.find((option) => option.value === sort.value).orderBy,
	})
	reloadCourses()
	getCourseCount()
	loadUpcomingCourses()
}

const updateFilters = () => {
	updateFieldFilters()
	updateTabFilter()
	updateStudentFilter()
	setQueryParams()
}

const setFilter = (key, value) => {
	if (value === undefined) delete filters.value[key]
	else filters.value[key] = value
}

const updateFieldFilters = () => {
	setFilter('category', currentCategory.value || undefined)
	setFilter('title', title.value ? ['like', `%${title.value}%`] : undefined)
	setFilter('certification', certification.value ? 1 : undefined)
	setFilter(
		'paid_course',
		price.value ? Number(price.value === 'paid') : undefined
	)
	setFilter('rating', rating.value ? ['>=', rating.value] : undefined)
}

const updateTabFilter = () => {
	delete filters.value['live']
	delete filters.value['created']
	delete filters.value['published_on']
	delete filters.value['upcoming']

	if (currentTab.value == 'enrolled' && user.data?.is_student) {
		filters.value['enrolled'] = 1
		delete filters.value['published']
	} else {
		delete filters.value['published']
		delete filters.value['enrolled']

		if (currentTab.value == 'live') {
			filters.value['published'] = 1
			filters.value['upcoming'] = 0
			filters.value['live'] = 1
		} else if (currentTab.value == 'upcoming') {
			filters.value['upcoming'] = 1
		} else if (currentTab.value == 'new') {
			filters.value['published'] = 1
			filters.value['published_on'] = [
				'>=',
				dayjs().add(-3, 'month').format('YYYY-MM-DD'),
			]
		} else if (currentTab.value == 'created') {
			filters.value['created'] = 1
		} else if (currentTab.value == 'unpublished') {
			filters.value['published'] = 0
		}
	}
}

const updateStudentFilter = () => {
	if (!user.data || (user.data?.is_student && currentTab.value != 'enrolled')) {
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
		rating: rating.value,
		sort: sort.value === 'popular' ? '' : sort.value,
	}

	Object.keys(filterKeys).forEach((key) => {
		if (filterKeys[key]) {
			queries.set(key, filterKeys[key])
		} else {
			queries.delete(key)
		}
	})

	let queryString = ''
	if (queries.toString()) {
		queryString = `?${queries.toString()}`
	}

	// Carry the existing state forward rather than replacing it with `{}`. This
	// page hosts form child routes whose open/close semantics hang off a marker
	// in history.state, and that marker only survives a reload through
	// window.history. `{}` also being truthy means vue-router never re-seeds its
	// own `position` key after such a reload, so every later pop delta is NaN.
	history.replaceState(history.state, '', `${location.pathname}${queryString}`)
}

const courseTabs = computed(() => {
	let tabs = [
		{
			label: __('Published'),
			value: 'live',
		},
		{
			label: __('Upcoming'),
			value: 'upcoming',
		},
	]
	if (
		user.data?.is_moderator ||
		user.data?.is_instructor ||
		user.data?.is_evaluator
	) {
		tabs.push({ label: __('Drafts'), value: 'unpublished' })
	} else if (user.data) {
		tabs.push({ label: __('Enrolled'), value: 'enrolled' })
	}
	return tabs
})

const { capture } = useTelemetry()

const openNewCourse = () => {
	setFormSource('header_button')
	router.push({ name: 'NewCourse' })
}

// What lands in this list and how to start it, for the person who would fill it;
// learners keep the default wording.
const emptyState = computed(() => {
	if (!canCreateCourse()) return null
	switch (currentTab.value) {
		case 'live':
			return {
				title: __('Publish your first course'),
				description: __(
					'Turn what you know into lessons, quizzes and a certificate people can take at their own pace.'
				),
			}
		case 'upcoming':
			return {
				title: __('No upcoming courses'),
				description: __(
					'Courses marked as upcoming show up here, so learners can see what is coming next.'
				),
			}
		case 'created':
			return {
				title: __('No courses created by you'),
				description: __(
					'Courses you create or teach show up here, for your team, students or customers.'
				),
			}
		case 'unpublished':
			return {
				title: __('No unpublished courses'),
				description: __(
					'New courses wait here while you build them. Publish one when it is ready.'
				),
			}
		default:
			return null
	}
})

function newCourseFromEmptyState() {
	setFormSource('empty_state')
	router.push({ name: 'NewCourse' })
}

const importMenu = computed(() => [
	{
		label: __('Import from a spreadsheet'),
		icon: 'lucide-upload',
		onClick() {
			capture('course_import_clicked', { via: 'spreadsheet' })
			router.push({ name: 'NewDataImport', params: { doctype: 'LMS Course' } })
		},
	},
	{
		label: __('Import via ZIP'),
		icon: 'lucide-folder-plus',
		onClick() {
			capture('course_import_clicked', { via: 'zip' })
			openFormRoute(router, { name: 'CourseImport' })
		},
	},
])

const breadcrumbs = computed(() => [
	{
		label: __('Courses'),
		route: { name: 'Courses' },
	},
])

usePageMeta(() => {
	return {
		title: __('Courses'),
		icon: brand.favicon,
	}
})
</script>
