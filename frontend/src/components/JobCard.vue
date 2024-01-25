<template>
	<div class="flex border rounded-md p-2 mb-4 h-full">
		<div class="mr-4">
			<img
				:src="job.company_logo"
				class="w-11 h-11 rounded-lg object-contain"
			/>
		</div>
		<div>
			<div class="text-lg font-semibold mb-2">
				{{ job.job_title }}
			</div>
			<div class="flex items-center mb-2 text-gray-700">
				<div class="mr-5">
					{{ job.company_name }}
				</div>
				<div class="flex items-center">
					<MapPin class="h-4 w-4 mr-1 stroke-1.5" />
					<span class="text-gray-700">
						{{ job.location }}
					</span>
				</div>
			</div>
			<div class="flex items-center">
				<Badge :label="job.type" theme="green" />
				<div class="ml-5">
					{{ dayjs(job.creation).format('DD MMM YYYY') }}
				</div>
			</div>
		</div>
	</div>
</template>
<script setup>
import { MapPin } from 'lucide-vue-next'
import { Badge } from 'frappe-ui'
import { inject } from 'vue'

const dayjs = inject('$dayjs')
const props = defineProps({
	job: {
		type: Object,
		default: null,
	},
})
</script>
