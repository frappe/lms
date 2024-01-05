<template>
	<div v-if="batch.doc" class="h-screen text-base">
		<header class="sticky top-0 z-10 border-b bg-white px-3 py-2.5 sm:px-5">
			<Breadcrumbs :items="breadcrumbs" />
		</header>
		<div class="m-5 pb-10">
			<div>
				<div class="text-3xl font-semibold">
					{{ batch.doc.title }}
				</div>
				<div class="my-3">
					{{ batch.doc.description }}
				</div>
				<div class="flex items-center justify-between w-1/2">
					<div class="flex items-center">
						<BookOpen class="h-4 w-4 text-gray-700 mr-2" />
						<span> {{ batch.doc.courses.length }} {{ __('Courses') }} </span>
					</div>
					<span v-if="batch.doc.courses">&middot;</span>
					<div class="flex items-center">
						<Calendar class="h-4 w-4 text-gray-700 mr-2" />
						<span>
							{{ dayjs(batch.doc.start_date).format('DD MMM YYYY') }} -
							{{ dayjs(batch.doc.end_date).format('DD MMM YYYY') }}
						</span>
					</div>
					<span v-if="batch.doc.start_date">&middot;</span>
					<div class="flex items-center">
						<Clock class="h-4 w-4 text-gray-700 mr-2" />
						<span>
							{{ formatTime(batch.doc.start_time) }} -
							{{ formatTime(batch.doc.end_time) }}
						</span>
					</div>
				</div>
			</div>
			<div class="grid grid-cols-[60%,20%] gap-20 mt-10">
				<div class="">
					<div v-html="batch.doc.batch_details" class="batch-description"></div>
				</div>
				<div>
					<BatchOverlay :batch="batch" />
				</div>
			</div>
			<div>
				<div class="text-2xl font-semibold">
					{{ __('Courses') }}
				</div>
				<div
					v-if="batch.doc.courses"
					v-for="course in batch.doc.courses"
					:key="course.course"
					class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8 mt-5"
				>
					<router-link
						:to="{
							name: 'CourseDetail',
							params: {
								courseName: course.course,
							},
						}"
					>
						<CourseCard :course="course.course" :key="course.course" />
					</router-link>
				</div>
			</div>
		</div>
	</div>
</template>
<script setup>
import { Breadcrumbs, createDocumentResource } from 'frappe-ui'
import { BookOpen, Calendar, Clock } from 'lucide-vue-next'
import { formatTime } from '../utils'
import { computed, inject } from 'vue'
import BatchOverlay from '@/components/BatchOverlay.vue'
import CourseCard from '@/components/CourseCard.vue'

const dayjs = inject('$dayjs')

const props = defineProps({
	batchName: {
		type: String,
		required: true,
	},
})

const batch = createDocumentResource({
	doctype: 'LMS Batch',
	name: props.batchName,
	cache: ['batch', props.batchName],
	auto: true,
})

const breadcrumbs = computed(() => {
	let items = [{ label: 'All Batches', route: { name: 'Batches' } }]
	items.push({
		label: batch?.doc?.title,
		route: { name: 'BatchDetail', params: { batchName: batch?.doc?.name } },
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
