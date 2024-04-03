<template>
	<div class="flex shadow rounded-md p-4 h-full">
		<img
			:src="job.company_logo"
			class="w-12 h-12 rounded-lg object-contain mr-4"
			:alt="job.company_name"
		/>
		<div>
			<div class="text-xl font-semibold mb-2">
				{{ job.job_title }}
			</div>
			<div>
				{{ __('posted by') }}
				<span class="font-medium">
					{{ job.company_name }}
				</span>
			</div>
			<div class="flex items-center my-4">
				<Badge :label="job.type" theme="green" size="lg" class="mr-4" />
				<Badge :label="job.location.split(' ')[0]" theme="gray" size="lg">
					<template #prefix>
						<MapPin class="h-4 w-4 stroke-1.5" />
					</template>
				</Badge>
			</div>
			<div>
				{{ __('posted on') }}
				<span class="font-medium">
					{{ dayjs(job.creation).format('DD MMM YYYY') }}
				</span>
			</div>
		</div>
	</div>
	<!-- <div class="flex flex-col shadow rounded-md p-4 h-full">
		<div class="flex justify-between">
			<div>
				<div class="text-xl font-semibold mb-2">
					{{ job.job_title }}
				</div>
				<div>
					{{ __("posted by") }}
					<span class="font-medium">
						{{ job.company_name }}
					</span>
				</div>
			</div>
			<img
				:src="job.company_logo"
				class="w-12 h-12 rounded-lg object-contain"
			/>
		</div>
		<div class="flex justify-between mt-8">
			<div class="flex items-center">
				<Badge :label="job.type" theme="green" size="lg" class="mr-4"/>
				<Badge :label="job.location" theme="gray" size="lg">
					<template #prefix>
						<MapPin class="h-4 w-4 stroke-1.5" />
					</template>
				</Badge>
			</div>
			<div>
				<span class="font-medium">
					{{ dayjs(job.creation).format('DD MMM YYYY') }}
				</span>
			</div>
		</div>
	</div> -->
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
