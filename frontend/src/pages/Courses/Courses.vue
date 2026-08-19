<template>
	<ListPage
		:breadcrumbs="breadcrumbs"
		:title="__('All Courses')"
		:rows="courses.data || []"
		:loading="courses.list.loading || reloading"
		:total-count="courseCount"
		:has-next-page="courses.hasNextPage"
		v-model:page-length="pageLength"
		empty-name="Courses"
		empty-icon="lucide-book-open"
		@load-more="courses.next()"
	>
		<template #actions>
			<Dropdown
				placement="right"
				side="bottom"
				v-if="canCreateCourse()"
				:options="courseMenu"
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
				:options="courseTabs"
				v-model="currentTab"
				class="!w-fit shrink-0"
			/>
			<FormControl
				v-model="title"
				:placeholder="__('Search')"
				:aria-label="__('Search')"
				type="text"
				@input="updateCourses()"
			>
				<template #prefix>
					<span class="lucide-search size-4 text-ink-gray-5" />
				</template>
			</FormControl>
			<ClearableCombobox
				v-if="categories.data?.length"
				v-model="currentCategory"
				:options="categories.data.filter((c) => c.value)"
				:placeholder="__('Category')"
				@update:modelValue="updateCourses()"
			/>
			<ToggleFilter
				:modelValue="certification"
				:label="__('Certification')"
				:mobileLabel="__('Certification available')"
				:tooltip="__('Only show courses that offer a certificate')"
				@update:modelValue="setCertification"
			/>
		</template>

		<template #card="{ row }">
			<router-link
				:to="{ name: 'CourseDetail', params: { courseName: row.name } }"
			>
				<CourseCard :course="row" />
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
import ListPage from '@/components/Layouts/ListPage.vue'
import { computed, inject, onMounted, ref, watch } from 'vue'
import { sessionStore } from '@/stores/session'
import { canCreateCourse } from '@/utils'
import CourseCard from '@/components/CourseCard.vue'
import { useRouter } from 'vue-router'
import { openFormRoute } from '@/composables/useFormRoute'

const user = inject('$user')
const dayjs = inject('$dayjs')
const start = ref(0)
const currentCategory = ref(null)
const title = ref('')
const certification = ref(false)

const setCertification = (value) => {
	certification.value = value
	updateCourses()
}
const filters = ref({})
const currentTab = ref('live')
const { brand } = sessionStore()
const router = useRouter()

onMounted(() => {
	setFiltersFromQuery()
	updateCourses()
})

const setFiltersFromQuery = () => {
	let queries = new URLSearchParams(location.search)
	title.value = queries.get('title') || ''
	currentCategory.value = queries.get('category') || null
	// `|| false` would keep the raw string, so ?certification=false read as on.
	certification.value = queries.get('certification') === 'true'
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

const updateCourses = () => {
	updateFilters()
	// createResource keeps no request sequence: every response assigns
	// `data`, so a slow fetch for filters the user has already left repaints
	// the list with the wrong courses seconds later. Cancel it first: an
	// aborted fetch is swallowed and never reaches the list.
	courses.list.abort()
	courses.update({
		filters: filters.value,
	})
	reloadCourses()
	getCourseCount()
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

watch(currentTab, () => {
	updateCourses()
})

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
		tabs.push({ label: __('Created'), value: 'created' })
		tabs.push({ label: __('Unpublished'), value: 'unpublished' })
	} else if (user.data) {
		tabs.push({ label: __('Enrolled'), value: 'enrolled' })
	}
	return tabs
})

const courseMenu = computed(() => {
	return [
		{
			label: __('New Course'),
			icon: 'lucide-book-open',
			onClick() {
				// openFormRoute, not a bare router.push: it stamps the history
				// entry so the form's own close() pops it instead of replacing.
				openFormRoute(router, { name: 'NewCourse' })
			},
		},
		{
			label: __('Import via Data Import Tool'),
			icon: 'lucide-upload',
			onClick() {
				router.push({
					name: 'NewDataImport',
					params: { doctype: 'LMS Course' },
				})
			},
		},
		{
			label: __('Import via ZIP'),
			icon: 'lucide-folder-plus',
			onClick() {
				openFormRoute(router, { name: 'CourseImport' })
			},
		},
	]
})

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
