<template>
	<LayoutHeader>
		<template #left-header>
			<Breadcrumbs :items="breadcrumbs" />
		</template>
		<template #right-header>
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
	</LayoutHeader>
	<div class="flex min-h-0 flex-1 flex-col p-5 pb-10">
		<div
			class="mb-5 flex flex-col justify-between space-y-4 lg:flex-row lg:items-center lg:space-y-0"
		>
			<div class="text-lg-semibold text-ink-gray-9">
				{{ __('All Courses') }}
			</div>
			<div
				class="flex flex-col space-y-4 lg:flex-row lg:items-center lg:gap-x-4 lg:space-y-0"
			>
				<TabButtons :options="courseTabs" v-model="currentTab" class="w-fit" />

				<FormControl
					v-model="title"
					:placeholder="__('Search')"
					type="text"
					class="w-full lg:w-40"
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
					class="w-full lg:w-40"
				/>

				<Tooltip :text="__('Only show courses that offer a certificate')">
					<FormControl
						type="checkbox"
						v-model="certification"
						:label="__('Certification')"
						@change="updateCourses()"
					/>
				</Tooltip>
			</div>
		</div>
		<SkeletonLoader
			v-if="courses.list.loading && !courses.data"
			variant="cards"
			:count="8"
		/>
		<div
			v-else-if="courses.data?.length"
			class="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
		>
			<router-link
				v-for="course in courses.data"
				:to="{ name: 'CourseDetail', params: { courseName: course.name } }"
			>
				<CourseCard :course="course" />
			</router-link>
		</div>
		<div v-else-if="!courses.list.loading" class="flex-1">
			<EmptyStateLayout name="Courses" icon="lucide-book-open" />
		</div>
		<div
			v-if="!courses.list.loading && courses.hasNextPage"
			class="flex justify-center mt-5"
		>
			<Button @click="courses.next()">
				{{ __('Load More') }}
			</Button>
		</div>
	</div>
	<NewCourseModal
		v-if="showCourseModal"
		v-model="showCourseModal"
		:courses="courses"
	/>

	<CourseImportModal
		v-if="showCourseImportModal"
		v-model="showCourseImportModal"
	/>
</template>
<script setup>
import {
	Breadcrumbs,
	Button,
	call,
	createListResource,
	Dropdown,
	FormControl,
	TabButtons,
	Tooltip,
	usePageMeta,
} from 'frappe-ui'
import ClearableCombobox from '@/components/Controls/ClearableCombobox.vue'
import { computed, inject, onMounted, ref, watch } from 'vue'
import { sessionStore } from '@/stores/session'
import { canCreateCourse } from '@/utils'
import CourseCard from '@/components/CourseCard.vue'
import SkeletonLoader from '@/components/SkeletonLoader.vue'
import EmptyStateLayout from '@/components/Layouts/EmptyStateLayout.vue'
import LayoutHeader from '@/components/Layouts/LayoutHeader.vue'
import { useRouter } from 'vue-router'
import NewCourseModal from '@/pages/Courses/NewCourseModal.vue'
import CourseImportModal from '@/pages/Courses/CourseImportModal.vue'

const user = inject('$user')
const dayjs = inject('$dayjs')
const start = ref(0)
const pageLength = ref(30)
const currentCategory = ref(null)
const title = ref('')
const certification = ref(false)
const filters = ref({})
const currentTab = ref('live')
const { brand } = sessionStore()
const courseCount = ref(0)
const router = useRouter()
const showCourseModal = ref(false)
const showCourseImportModal = ref(false)

onMounted(() => {
	setFiltersFromQuery()
	updateCourses()
	getCourseCount()
})

const setFiltersFromQuery = () => {
	let queries = new URLSearchParams(location.search)
	title.value = queries.get('title') || ''
	currentCategory.value = queries.get('category') || null
	certification.value = queries.get('certification') || false
	const tab = queries.get('tab')
	if (tab) currentTab.value = tab
	if (queries.get('newCourse') == '1') {
		showCourseModal.value = true
	}
}

const courses = createListResource({
	doctype: 'LMS Course',
	url: 'lms.lms.utils.get_courses',
	cache: ['courses', user.data?.name],
	pageLength: pageLength.value,
	start: start.value,
})

const categories = createListResource({
	doctype: 'LMS Category',
	url: 'lms.lms.utils.get_course_categories',
	cache: ['course_categories'],
	auto: true,
})

const getCourseCount = () => {
	if (!user.data) return
	if (!user.data.is_moderator) return
	call('frappe.client.get_count', {
		doctype: 'LMS Course',
	}).then((data) => {
		courseCount.value = data
	})
}

const updateCourses = () => {
	updateFilters()
	courses.update({
		filters: filters.value,
	})
	courses.reload()
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

	history.replaceState({}, '', `${location.pathname}${queryString}`)
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
				showCourseModal.value = true
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
				showCourseImportModal.value = true
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
