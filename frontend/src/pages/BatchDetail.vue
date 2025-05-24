<template>
	<div v-if="batch.data" class="">
		<header
			class="sticky top-0 z-10 border-b bg-surface-white px-3 py-2.5 sm:px-5"
		>
			<Breadcrumbs :items="breadcrumbs" />
		</header>
		<div class="m-5 pb-10">
			<div class="flex justify-between w-full">
				<div class="md:w-2/3">
					<div class="text-3xl font-semibold text-ink-gray-9">
						{{ batch.data.title }}
					</div>
					<div class="my-3 leading-6 text-ink-gray-7">
						{{ batch.data.description }}
					</div>
					<div class="flex avatar-group overlap">
						<div
							class="h-6 mr-1"
							:class="{
								'avatar-group overlap': batch.data.instructors.length > 1,
							}"
						>
							<UserAvatar
								v-for="instructor in batch.data.instructors"
								:user="instructor"
							/>
						</div>
						<CourseInstructors :instructors="batch.data.instructors" />
					</div>
					<div
						class="ProseMirror prose prose-table:table-fixed prose-td:p-2 prose-th:p-2 prose-td:border prose-th:border prose-td:border-outline-gray-2 prose-th:border-outline-gray-2 prose-td:relative prose-th:relative prose-th:bg-surface-gray-2 prose-sm max-w-none !whitespace-normal mt-10"
						v-html="batch.data.batch_details"
					></div>
				</div>
				<div class="hidden md:block">
					<BatchOverlay :batch="batch" />
				</div>
			</div>
			<!-- <div class="grid lg:grid-cols-[60%,20%] gap-4 lg:gap-20 mt-10">
				<div class="order-2 lg:order-none">
					
				</div>
				<div class="order-1 lg:order-none">
					<BatchOverlay :batch="batch" />
				</div>
			</div> -->
			<div v-if="batch.data.courses.length">
				<div class="flex items-center mt-10">
					<div class="text-2xl font-semibold">
						{{ __('Courses') }}
					</div>
				</div>
				<div class="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-5">
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
import { BookOpen, Clock } from 'lucide-vue-next'
import { formatTime } from '@/utils'
import { Breadcrumbs, createResource, usePageMeta } from 'frappe-ui'
import { sessionStore } from '@/stores/session'
import CourseCard from '@/components/CourseCard.vue'
import BatchOverlay from '@/components/BatchOverlay.vue'
import DateRange from '../components/Common/DateRange.vue'
import CourseInstructors from '@/components/CourseInstructors.vue'
import UserAvatar from '@/components/UserAvatar.vue'

const user = inject('$user')
const router = useRouter()
const { brand } = sessionStore()

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
	onSuccess: (data) => {
		if (!data) {
			router.push({ name: 'Batches' })
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
	let items = [{ label: 'Batches', route: { name: 'Batches' } }]
	items.push({
		label: batch?.data?.title,
		route: { name: 'BatchDetail', params: { batchName: batch?.data?.name } },
	})
	return items
})

usePageMeta(() => {
	return {
		title: batch?.data?.title,
		icon: brand.favicon,
	}
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
