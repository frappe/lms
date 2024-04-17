<template>
	<div v-if="courses.data">
		<header
			class="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-3 py-2.5 sm:px-5"
		>
			<Breadcrumbs
				class="h-7"
				:items="[{ label: __('All Courses'), route: { name: 'Courses' } }]"
			/>
			<div class="flex">
				<router-link
					:to="{
						name: 'CreateCourse',
						params: {
							courseName: 'new',
						},
					}"
				>
					<Button v-if="user.data?.is_moderator" variant="solid">
						<template #prefix>
							<Plus class="h-4 w-4" />
						</template>
						{{ __('New Course') }}
					</Button>
				</router-link>
			</div>
		</header>
		<div class="">
			<div
				v-if="courses.data.length == 0 && courses.list.loading"
				class="p-5 text-base text-gray-700"
			>
				{{ __('Loading Courses...') }}
			</div>
			<Tabs
				v-else
				v-model="tabIndex"
				tablistClass="overflow-x-visible flex-wrap !gap-3 md:flex-nowrap"
				:tabs="tabs"
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
												chapterNumber: course.current_lesson.split('.')[0],
												lessonNumber: course.current_lesson.split('.')[1],
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
import { createListResource, Breadcrumbs, Tabs, Badge, Button } from 'frappe-ui'
import CourseCard from '@/components/CourseCard.vue'
import { Plus } from 'lucide-vue-next'
import { ref, computed, inject } from 'vue'
import { updateDocumentTitle } from '@/utils'

const user = inject('$user')
const courses = createListResource({
	type: 'list',
	doctype: 'LMS Course',
	cache: ['courses', user?.data?.email],
	url: 'lms.lms.utils.get_courses',
	auto: true,
})

const tabIndex = ref(0)
const tabs = [
	{
		label: 'Live',
		courses: computed(() => courses.data?.live || []),
		count: computed(() => courses.data?.live?.length),
	},
	{
		label: 'New',
		courses: computed(() => courses.data?.new),
		count: computed(() => courses.data?.new?.length),
	},
	{
		label: 'Upcoming',
		courses: computed(() => courses.data?.upcoming),
		count: computed(() => courses.data?.upcoming?.length),
	},
]

if (user.data) {
	tabs.push({
		label: 'Enrolled',
		courses: computed(() => courses.data?.enrolled),
		count: computed(() => courses.data?.enrolled?.length),
	})

	if (
		user.data.is_moderator ||
		user.data.is_instructor ||
		courses.data?.created?.length
	) {
		tabs.push({
			label: 'Created',
			courses: computed(() => courses.data?.created),
			count: computed(() => courses.data?.created?.length),
		})
	}

	if (user.data.is_moderator) {
		tabs.push({
			label: 'Under Review',
			courses: computed(() => courses.data?.under_review),
			count: computed(() => courses.data?.under_review?.length),
		})
	}
}

const pageMeta = computed(() => {
	return {
		title: 'Courses',
		description: 'All Courses divided by categories',
	}
})

updateDocumentTitle(pageMeta)
</script>
