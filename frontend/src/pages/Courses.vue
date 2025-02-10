<template>
	<div v-if="courses.data">
		<header
			class="sticky top-0 z-10 flex items-center justify-between border-b bg-surface-white px-3 py-2.5 sm:px-5"
		>
			<Breadcrumbs
				class="h-7"
				:items="[{ label: __('Courses'), route: { name: 'Courses' } }]"
			/>
			<div class="flex space-x-2 justify-end">
				<div class="w-40 md:w-44">
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
							<Search
								class="w-4 h-4 stroke-1.5 text-ink-gray-5"
								name="search"
							/>
						</template>
					</FormControl>
				</div>
				<router-link
					v-if="user.data?.is_moderator || user.data?.is_instructor"
					:to="{
						name: 'CourseForm',
						params: {
							courseName: 'new',
						},
					}"
				>
					<Button variant="solid">
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
				v-if="hasCourses"
				as="div"
				v-model="tabIndex"
				tablistClass="overflow-x-visible flex-wrap !gap-3 md:flex-nowrap"
				:tabs="makeTabs"
			>
				<template #tab="{ tab, selected }">
					<div>
						<button
							class="group -mb-px flex items-center gap-2 overflow-hidden border-b border-transparent py-2.5 text-base text-ink-gray-5 duration-300 ease-in-out hover:border-outline-gray-3 hover:text-ink-gray-9"
							:class="{ 'text-ink-gray-9': selected }"
						>
							<component v-if="tab.icon" :is="tab.icon" class="h-5" />
							{{ __(tab.label) }}
							<Badge theme="gray">
								{{ tab.count }}
							</Badge>
						</button>
					</div>
				</template>
				<template #tab-panel="{ tab }">
					<div
						v-if="tab.courses && tab.courses.value.length"
						class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 3xl:grid-cols-5 gap-7 my-5 mx-5"
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
					<div v-else class="p-5 italic text-ink-gray-4">
						{{ __('No {0} courses').format(tab.label.toLowerCase()) }}
					</div>
				</template>
			</Tabs>
			<div
				v-else-if="
					!courses.loading &&
					(user.data?.is_moderator || user.data?.is_instructor)
				"
				class="grid grid-cols-3 p-5"
			>
				<router-link
					:to="{
						name: 'CourseForm',
						params: {
							courseName: 'new',
						},
					}"
				>
					<div class="bg-surface-menu-bar py-32 px-5 rounded-md">
						<div class="flex flex-col items-center text-center space-y-2">
							<Plus
								class="size-10 stroke-1 text-ink-gray-8 p-1 rounded-full border bg-surface-white"
							/>
							<div class="font-medium">
								{{ __('Create a Course') }}
							</div>
							<span class="text-ink-gray-7 text-sm leading-4">
								{{ __('You can add chapters and lessons to it.') }}
							</span>
						</div>
					</div>
				</router-link>
			</div>
			<div
				v-else-if="!courses.loading && !hasCourses"
				class="text-center p-5 text-ink-gray-5 mt-52 w-3/4 md:w-1/2 mx-auto space-y-2"
			>
				<BookOpen class="size-10 mx-auto stroke-1 text-ink-gray-4" />
				<div class="text-xl font-medium">
					{{ __('No courses found') }}
				</div>
				<div class="leading-5">
					{{
						__(
							'There are no courses available at the moment. Keep an eye out, fresh learning experiences are on the way soon!'
						)
					}}
				</div>
			</div>
		</div>
	</div>
</template>

<script setup>
import {
	Badge,
	Breadcrumbs,
	Button,
	call,
	createResource,
	FormControl,
	Tabs,
} from 'frappe-ui'
import CourseCard from '@/components/CourseCard.vue'
import { BookOpen, Plus, Search } from 'lucide-vue-next'
import { ref, computed, inject, onMounted, watch } from 'vue'
import { updateDocumentTitle } from '@/utils'
import { useRouter } from 'vue-router'
import { useSettings } from '@/stores/settings'

const user = inject('$user')
const searchQuery = ref('')
const currentCategory = ref(null)
const hasCourses = ref(false)
const router = useRouter()
const settings = useSettings()

onMounted(() => {
	checkLearningPath()
	let queries = new URLSearchParams(location.search)
	if (queries.has('category')) {
		currentCategory.value = queries.get('category')
	}
})

const checkLearningPath = () => {
	if (
		settings.learningPaths.data &&
		(!user.data?.is_moderator || !user.data?.is_instructor)
	) {
		router.push({ name: 'Programs' })
	}
}

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

watch(courses, () => {
	if (courses.data) {
		Object.keys(courses.data).forEach((section) => {
			if (courses.data[section].length) {
				hasCourses.value = true
			}
		})
	}
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
