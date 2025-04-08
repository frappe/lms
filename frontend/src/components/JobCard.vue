<template>
	<div class="border rounded-md p-4">
		<div class="flex space-x-4">
			<img
				:src="job.company_logo"
				class="size-10 rounded-full object-contain"
			/>
			<div class="flex flex-col space-y-1 flex-1">
				<div class="flex items-center justify-between">
					<span class="text-lg font-semibold text-ink-gray-9">
						{{ job.job_title }}
					</span>
				</div>
				<div class="text-xs text-ink-gray-5">
					{{ job.company_name }}
				</div>
			</div>
		</div>
		<div class="space-x-4 mt-2">
			<Badge>
				{{ job.location }}
			</Badge>
			<Badge>
				{{ job.type }}
			</Badge>
			<Badge>
				{{ dayjs(job.creation).fromNow() }}
			</Badge>
		</div>
	</div>
</template>
<script setup>
import { inject } from 'vue'
import { Badge } from 'frappe-ui'

const dayjs = inject('$dayjs')
const props = defineProps({
	job: {
		type: Object,
		default: null,
	},
})
</script>
