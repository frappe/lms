<template>
	<div class="h-screen text-base">
		<header
			class="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-3 py-2.5 sm:px-5"
		>
			<Breadcrumbs class="h-7" :items="breadcrumbs" />
		</header>
		<div v-if="batch.doc">
			<div class="grid grid-cols-[70%,30%] h-full">
				<div class="border-r-2"></div>
				<div class="p-5">
					<div class="text-2xl font-semibold mb-3">
						{{ batch.doc.title }}
					</div>
					<div class="flex items-center mb-2">
						<Calendar class="h-4 w-4 stroke-1.5 mr-2 text-gray-700" />
						<span>
							{{ dayjs(batch.doc.start_date).format('DD MMM YYYY') }} -
							{{ dayjs(batch.doc.end_date).format('DD MMM YYYY') }}
						</span>
					</div>
					<div class="flex items-center mb-6">
						<Clock class="h-4 w-4 stroke-1.5 mr-2 text-gray-700" />
						<span>
							{{ formatTime(batch.doc.start_time) }} -
							{{ formatTime(batch.doc.end_time) }}
						</span>
					</div>
					<div v-html="batch.doc.description"></div>
				</div>
			</div>
		</div>
	</div>
</template>
<script setup>
import { Breadcrumbs, createDocumentResource } from 'frappe-ui'
import { computed, inject } from 'vue'
import { Calendar, Clock } from 'lucide-vue-next'
import { formatTime } from '@/utils'

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
	return [
		{ label: 'All Batches', route: { name: 'Batches' } },
		{
			label: 'Batch Details',
			route: { name: 'BatchDetail', params: { batchName: props.batchName } },
		},
		{
			label: batch?.doc?.title,
			route: { name: 'Batch', params: { batchName: props.batchName } },
		},
	]
})
</script>
