<template>
	<div>
		<div class="mt-10 space-y-10">
			<UpcomingEvaluations :forHome="true" />
			<div v-if="myLiveClasses.data?.length">
				<h2 class="font-semibold text-md mb-3 text-ink-gray-9">
					{{ __('Upcoming Live Classes') }}
				</h2>
				<div class="grid grid-cols-1 md:grid-cols-4 gap-5">
					<div
						v-for="cls in myLiveClasses.data"
						:key="cls.name"
						class="border rounded-5 hover:border-outline-gray-3 p-3"
					>
						<div class="font-semibold text-ink-gray-9 leading-5 mb-1">
							{{ cls.title }}
						</div>
						<div class="text-ink-gray-5 leading-5 mb-4">
							{{ cls.description }}
						</div>
						<LiveClassCard
							:cls="cls"
							class="space-y-4"
							ended-class="text-ink-amber-2"
						/>
					</div>
				</div>
			</div>
		</div>

		<div v-if="myCourses.data?.length" class="mt-10">
			<div class="flex items-center justify-between mb-3">
				<h2 class="font-semibold text-md text-ink-gray-9">
					{{
						myCourses.data[0].membership
							? __('My Courses')
							: __('Our Popular Courses')
					}}
				</h2>
				<router-link
					:to="{
						name: 'Courses',
					}"
				>
					<span class="flex items-center gap-x-1 text-ink-gray-5 text-xs">
						<span>
							{{ __('See all') }}
						</span>
						<span class="lucide-move-right size-3 rtl:rotate-180" />
					</span>
				</router-link>
			</div>
			<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
				<router-link
					v-for="course in myCourses.data"
					:key="course.name"
					:to="{ name: 'CourseDetail', params: { courseName: course.name } }"
				>
					<CourseCard :course="course" />
				</router-link>
			</div>
		</div>

		<div v-if="myBatches.data?.length" class="mt-10">
			<div class="flex items-center justify-between mb-3">
				<h2 class="font-semibold text-md text-ink-gray-9">
					{{
						myBatches.data?.[0].students?.includes(user.data?.name)
							? __('My Batches')
							: __('Our Upcoming Batches')
					}}
				</h2>
				<router-link
					:to="{
						name: 'Batches',
					}"
				>
					<span class="flex items-center gap-x-1 text-ink-gray-5 text-xs">
						<span>
							{{ __('See all') }}
						</span>
						<span class="lucide-move-right size-3 rtl:rotate-180" />
					</span>
				</router-link>
			</div>
			<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
				<router-link
					v-for="batch in myBatches.data"
					:key="batch.name"
					:to="{ name: 'BatchDetail', params: { batchName: batch.name } }"
				>
					<BatchCard :batch="batch" />
				</router-link>
			</div>
		</div>
	</div>
</template>
<script setup lang="ts">
import { inject } from 'vue'
import { createResource } from 'frappe-ui'
import CourseCard from '@/components/CourseCard.vue'
import BatchCard from '@/pages/Batches/components/BatchCard.vue'
import UpcomingEvaluations from '@/components/UpcomingEvaluations.vue'
import LiveClassCard from '@/pages/Home/LiveClassCard.vue'

const user = inject<any>('$user')

const props = defineProps<{
	myLiveClasses: any
}>()

const myCourses = createResource({
	url: 'lms.lms.api.get_my_courses',
	auto: true,
})

const myBatches = createResource({
	url: 'lms.lms.api.get_my_batches',
	auto: true,
})
</script>
