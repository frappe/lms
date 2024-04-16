<template>
	<div v-if="batch.data" class="">
		<header class="sticky top-0 z-10 border-b bg-white px-3 py-2.5 sm:px-5">
			<Breadcrumbs :items="breadcrumbs" />
		</header>
		<div class="m-5 pb-10">
			<div>
				<div class="text-3xl font-semibold">
					{{ batch.data.title }}
				</div>
				<div class="my-3">
					{{ batch.data.description }}
				</div>
				<div class="flex items-center justify-between w-1/2">
					<div class="flex items-center">
						<BookOpen class="h-4 w-4 text-gray-700 mr-2" />
						<span> {{ batch.data?.courses?.length }} {{ __('Courses') }} </span>
					</div>
					<span v-if="batch.data.courses">&middot;</span>
					<DateRange
						:startDate="batch.data.start_date"
						:endDate="batch.data.end_date"
					/>
					<span v-if="batch.data.start_date">&middot;</span>
					<div class="flex items-center">
						<Clock class="h-4 w-4 text-gray-700 mr-2" />
						<span>
							{{ formatTime(batch.data.start_time) }} -
							{{ formatTime(batch.data.end_time) }}
						</span>
					</div>
				</div>
			</div>
			<div class="grid grid-cols-[60%,20%] gap-20 mt-10">
				<div class="">
					<div
						class="ProseMirror prose prose-table:table-fixed prose-td:p-2 prose-th:p-2 prose-td:border prose-th:border prose-td:border-gray-300 prose-th:border-gray-300 prose-td:relative prose-th:relative prose-th:bg-gray-100 prose-sm max-w-none !whitespace-normal mt-6"
						v-html="batch.data.batch_details"
					></div>
				</div>
				<div>
					<BatchOverlay :batch="batch" />
				</div>
			</div>
			<div v-if="batch.data.courses.length">
				<div class="flex items-center mt-10">
					<div class="text-2xl font-semibold">
						{{ __('Courses') }}
					</div>
				</div>
				<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8 mt-5">
					<div
						v-if="batch.data.courses"
						v-for="course in courses.data"
						:key="course.course"
					>
						<router-link
							:to="{
								name: 'CourseDetail',
								params: {
									courseName: course.name,
								},
							}"
						>
							<CourseCard :course="course" :key="course.name" />
						</router-link>
					</div>
				</div>
				<div v-if="batch.data.batch_details_raw">
					<div
						v-html="batch.data.batch_details_raw"
						class="batch-description"
					></div>
				</div>
			</div>
		</div>
	</div>
</template>
<script setup>
import { computed, inject } from 'vue'
import { useRouter } from 'vue-router'
import { BookOpen, Calendar, Clock } from 'lucide-vue-next'
import { formatTime } from '@/utils'
import { Breadcrumbs, createResource } from 'frappe-ui'
import CourseCard from '@/components/CourseCard.vue'
import BatchOverlay from '@/components/BatchOverlay.vue'
import DateRange from '../components/Common/DateRange.vue'

const user = inject('$user')
const router = useRouter()

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
	onSuccess(data) {
		if (data.students?.includes(user.data?.name)) {
			router.push({
				name: 'Batch',
				params: {
					batchName: props.batchName,
				},
			})
		}
	},
})

const courses = createResource({
	url: 'lms.lms.utils.get_batch_courses',
	params: {
		batch: props.batchName,
	},
	cache: ['batchCourses', props.batchName],
	auto: true,
})

const breadcrumbs = computed(() => {
	let items = [{ label: 'All Batches', route: { name: 'Batches' } }]
	items.push({
		label: batch?.data?.title,
		route: { name: 'BatchDetail', params: { batchName: batch?.data?.name } },
	})
	return items
})
</script>
<style>
.batch-description p {
	margin-bottom: 1rem;
	line-height: 1.7;
}

.batch-description li {
	line-height: 1.7;
}

.batch-description ol {
	list-style: auto;
	margin: revert;
	padding: revert;
}

.batch-description strong {
	font-weight: 600;
	color: theme('colors.gray.900') !important;
}
</style>
