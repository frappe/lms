<template>
	<div v-if="courses.data">
		<header
			class="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-3 py-2.5 sm:px-5"
		>
			<Breadcrumbs
				class="h-7"
				:items="[{ label: __('Courses'), route: { name: 'Courses' } }]"
			/>
			<div class="flex space-x-2 justify-end">
				<div class="w-46 md:w-44">
					<FormControl
						v-if="categories.data?.length"
						type="select"
						v-model="currentCategory"
						:options="categories.data"
						:placeholder="__('Category')"
					/>
				</div>
				<div class="w-28 md:w-36">
					<FormControl
						type="text"
						placeholder="Search"
						v-model="searchQuery"
						@input="courses.reload()"
					>
						<template #prefix>
							<Search class="w-4 h-4 stroke-1.5 text-gray-600" name="search" />
						</template>
					</FormControl>
				</div>
				<router-link
					:to="{
						name: 'CourseForm',
						params: {
							courseName: 'new',
						},
					}"
				>
					<Button v-if="user.data?.is_moderator" variant="solid">
						<template #prefix>
							<Plus class="h-4 w-4" />
						</template>
						{{ __('New') }}
					</Button>
				</router-link>
			</div>
		</header>
		<div class="">
			<Tabs
				v-model="tabIndex"
				tablistClass="overflow-x-visible flex-wrap !gap-3 md:flex-nowrap"
				:tabs="makeTabs"
			>
				<template #tab="{ tab, selected }">
					<div>
						<button
							class="group -mb-px flex items-center gap-2 overflow-hidden border-b border-transparent py-2.5 text-base text-gray-600 duration-300 ease-in-out hover:border-gray-400 hover:text-gray-900"
							:class="{ 'text-gray-900': selected }"
						>
							<component v-if="tab.icon" :is="tab.icon" class="h-5" />
							{{ __(tab.label) }}
							<Badge theme="gray">
								{{ tab.count }}
							</Badge>
						</button>
					</div>
				</template>
				<template #default="{ tab }">
					<div
						v-if="tab.courses && tab.courses.value.length"
						class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 my-5 mx-5"
					>
						<router-link
							v-for="course in tab.courses.value"
							:to="
								course.membership && course.current_lesson
									? {
											name: 'Lesson',
											params: {
												courseName: course.name,
												chapterNumber: course.current_lesson.split('-')[0],
												lessonNumber: course.current_lesson.split('-')[1],
											},
									  }
									: course.membership
									? {
											name: 'Lesson',
											params: {
												courseName: course.name,
												chapterNumber: 1,
												lessonNumber: 1,
											},
									  }
									: {
											name: 'CourseDetail',
											params: { courseName: course.name },
									  }
							"
						>
							<CourseCard :course="course" />
						</router-link>
					</div>
					<div
						v-else
						class="grid flex-1 place-items-center text-xl font-medium text-gray-500"
					>
						<div class="flex flex-col items-center justify-center mt-4">
							<div>
								{{ __('No {0} courses found').format(tab.label.toLowerCase()) }}
							</div>
						</div>
					</div>
				</template>
			</Tabs>
		</div>
	</div>
</template>

<script setup>
import {
	Breadcrumbs,
	Tabs,
	Badge,
	Button,
	FormControl,
	createResource,
} from 'frappe-ui'
import CourseCard from '@/components/CourseCard.vue'
import { Plus, Search } from 'lucide-vue-next'
import { ref, computed, inject, onMounted, watch } from 'vue'
import { updateDocumentTitle } from '@/utils'

const user = inject('$user')
const searchQuery = ref('')
const currentCategory = ref(null)

onMounted(() => {
	let queries = new URLSearchParams(location.search)
	if (queries.has('category')) {
		currentCategory.value = queries.get('category')
	}
})

const courses = createResource({
	url: 'lms.lms.utils.get_courses',
	cache: ['courses', user.data?.email],
	auto: true,
})

const tabIndex = ref(0)
let tabs

const makeTabs = computed(() => {
	tabs = []
	addToTabs('Live')
	addToTabs('New')
	addToTabs('Upcoming')

	if (user.data) {
		addToTabs('Enrolled')

		if (
			user.data.is_moderator ||
			user.data.is_instructor ||
			courses.data?.created?.length
		) {
			addToTabs('Created')
		}

		if (user.data.is_moderator) {
			addToTabs('Under Review')
		}
	}
	return tabs
})

const addToTabs = (label) => {
	let courses = getCourses(label.toLowerCase().split(' ').join('_'))
	tabs.push({
		label,
		courses: computed(() => courses),
		count: computed(() => courses.length),
	})
}

const getCourses = (type) => {
	let courseList = courses.data[type]
	if (searchQuery.value) {
		let query = searchQuery.value.toLowerCase()
		courseList = courseList.filter(
			(course) =>
				course.title.toLowerCase().includes(query) ||
				course.short_introduction.toLowerCase().includes(query) ||
				course.tags.filter((tag) => tag.toLowerCase().includes(query)).length
		)
	}
	if (currentCategory.value && currentCategory.value != '') {
		courseList = courseList.filter(
			(course) => course.category == currentCategory.value
		)
	}
	return courseList
}

const categories = createResource({
	url: 'lms.lms.api.get_categories',
	makeParams() {
		return {
			doctype: 'LMS Course',
			filters: {
				published: 1,
			},
		}
	},
	cache: ['courseCategories'],
	auto: true,
	transform(data) {
		data.unshift({
			label: '',
			value: null,
		})
	},
})

watch(
	() => currentCategory.value,
	() => {
		let queries = new URLSearchParams(location.search)
		if (currentCategory.value) {
			queries.set('category', currentCategory.value)
		} else {
			queries.delete('category')
		}
		history.pushState(null, '', `${location.pathname}?${queries.toString()}`)
	}
)

const pageMeta = computed(() => {
	return {
		title: 'Courses',
		description: 'All Courses divided by categories',
	}
})

updateDocumentTitle(pageMeta)
</script>
