<template>
	<div v-if="user.data?.is_moderator || isStudent" class="h-screen text-base">
		<header
			class="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-3 py-2.5 sm:px-5"
		>
			<Breadcrumbs class="h-7" :items="breadcrumbs" />
		</header>
		<div v-if="batch.data">
			<div class="grid grid-cols-[70%,30%] h-full">
				<div class="border-r-2">
					<Tabs class="overflow-hidden" v-model="tabIndex" :tabs="tabs">
						<template #tab="{ tab, selected }">
							<div>
								<button
									class="group -mb-px flex items-center gap-1 border-b border-transparent py-2.5 text-base text-gray-600 duration-300 ease-in-out hover:border-gray-400 hover:text-gray-900"
									:class="{ 'text-gray-900': selected }"
								>
									<component
										v-if="tab.icon"
										:is="tab.icon"
										class="h-4 stroke-1.5"
									/>
									{{ __(tab.label) }}
									<Badge
										v-if="tab.count"
										:class="{
											'text-gray-900 border border-gray-900': selected,
										}"
										variant="subtle"
										theme="gray"
										size="sm"
									>
										{{ tab.count }}
									</Badge>
								</button>
							</div>
						</template>
						<template #default="{ tab }">
							<div class="pt-5 px-10 pb-10">
								<div v-if="tab.label == 'Courses'">
									<div class="text-xl font-semibold">
										{{ __('Courses') }}
									</div>
									<div
										class="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 gap-8 mt-5"
									>
										<div v-for="course in courses.data">
											<router-link
												:to="{
													name: 'CourseDetail',
													params: {
														courseName: course.name,
													},
												}"
											>
												<CourseCard :key="course.name" :course="course" />
											</router-link>
										</div>
									</div>
								</div>
								<div v-else-if="tab.label == 'Dashboard'">
									<BatchDashboard :batch="batch" :isStudent="isStudent" />
								</div>
								<div v-else-if="tab.label == 'Live Class'">
									<LiveClass :batch="batch.data.name" />
								</div>
								<div v-else-if="tab.label == 'Students'">
									<BatchStudents :batch="batch.data.name" />
								</div>
								<div v-else-if="tab.label == 'Assessments'">
									<Assessments :batch="batch.data.name" />
								</div>
							</div>
						</template>
					</Tabs>
				</div>
				<div class="p-5">
					<div class="text-2xl font-semibold mb-3">
						{{ batch.data.title }}
					</div>
					<div class="flex items-center mb-3">
						<Calendar class="h-4 w-4 stroke-1.5 mr-2 text-gray-700" />
						<span>
							{{ dayjs(batch.data.start_date).format('DD MMMM YYYY') }} -
							{{ dayjs(batch.data.end_date).format('DD MMMM YYYY') }}
						</span>
					</div>
					<div class="flex items-center mb-6">
						<Clock class="h-4 w-4 stroke-1.5 mr-2 text-gray-700" />
						<span>
							{{ formatTime(batch.data.start_time) }} -
							{{ formatTime(batch.data.end_time) }}
						</span>
					</div>
					<div v-html="batch.data.description"></div>
				</div>
			</div>
		</div>
	</div>
	<div v-else class="h-screen">
		<div class="text-base border rounded-md w-1/3 mx-auto my-32">
			<div class="border-b px-5 py-3 font-medium">
				<span
					class="inline-flex items-center before:bg-red-600 before:w-2 before:h-2 before:rounded-md before:mr-2"
				></span>
				{{ __('Not Permitted') }}
			</div>
			<div class="px-5 py-3">
				<div v-if="user.data" class="mb-4 leading-6">
					{{
						__(
							'You are not a member of this batch. Please checkout our upcoming batches.'
						)
					}}
				</div>
				<div v-else class="mb-4 leading-6">
					{{ __('Please login to access this page.') }}
				</div>
				<router-link
					v-if="user.data"
					:to="{
						name: 'Batches',
						params: {
							batchName: batch.data?.name,
						},
					}"
				>
					<Button variant="solid" class="w-full">
						{{ __('Upcoming Batches') }}
					</Button>
				</router-link>
				<Button
					v-else
					variant="solid"
					class="w-full"
					@click="redirectToLogin()"
				>
					{{ __('Login') }}
				</Button>
			</div>
		</div>
	</div>
</template>
<script setup>
import { Breadcrumbs, Button, createResource, Tabs, Badge } from 'frappe-ui'
import { computed, inject, ref } from 'vue'
import {
	Calendar,
	Clock,
	LayoutDashboard,
	BookOpen,
	Laptop,
	BookOpenCheck,
	Contact2,
} from 'lucide-vue-next'
import { formatTime } from '@/utils'
import CourseCard from '@/components/CourseCard.vue'
import BatchDashboard from '@/components/BatchDashboard.vue'
import LiveClass from '@/components/LiveClass.vue'
import BatchStudents from '@/components/BatchStudents.vue'
import Assessments from '@/components/Assessments.vue'

const dayjs = inject('$dayjs')
const user = inject('$user')

const props = defineProps({
	batchName: {
		type: String,
		required: true,
	},
})

const batch = createResource({
	url: 'lms.lms.utils.get_batch_details',
	cache: ['batch', props.batchName],
	params: {
		batch: props.batchName,
	},
	auto: true,
})

const breadcrumbs = computed(() => {
	return [
		{ label: 'All Batches', route: { name: 'Batches' } },
		{
			label: 'Batch Details',
			route: { name: 'BatchDetail', params: { batchName: props.batchName } },
		},
		{
			label: batch?.data?.title,
			route: { name: 'Batch', params: { batchName: props.batchName } },
		},
	]
})

const isStudent = computed(() => {
	return (
		user?.data &&
		batch.data?.students.length &&
		batch.data?.students.includes(user.data.name)
	)
})

const tabIndex = ref(0)
const tabs = []

if (isStudent.value) {
	tabs.push({
		label: 'Dashboard',
		icon: LayoutDashboard,
	})
}

if (user.data?.is_moderator) {
	tabs.push({
		label: 'Students',
		icon: Contact2,
	})
	tabs.push({
		label: 'Assessments',
		icon: BookOpenCheck,
	})
}

tabs.push({
	label: 'Live Class',
	icon: Laptop,
})

tabs.push({
	label: 'Courses',
	icon: BookOpen,
})

const courses = createResource({
	url: 'lms.lms.utils.get_batch_courses',
	params: {
		batch: props.batchName,
	},
	cache: ['batchCourses', props.batchName],
	auto: true,
})

const redirectToLogin = () => {
	window.location.href = `/login?redirect-to=/batches`
}
</script>
