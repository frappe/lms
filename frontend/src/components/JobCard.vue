<template>
	<div class="flex space-x-4 border rounded-md p-2">
		<img :src="job.company_logo" class="size-10 rounded-full object-contain" />
		<div class="flex flex-col space-y-2 flex-1">
			<div class="flex items-center justify-between">
				<span class="font-semibold text-ink-gray-9">
					{{ job.job_title }}
				</span>
			</div>
			<div class="flex items-center space-x-2 text-ink-gray-5">
				<Building2 class="w-4 h-4 stroke-1.5" />
				<span>
					{{ job.company_name }}
				</span>
			</div>
			<div class="flex items-center space-x-2 text-ink-gray-5">
				<MapPin class="w-4 h-4 stroke-1.5" />
				<span>
					{{ job.location }}
				</span>
			</div>
			<div class="flex items-center space-x-2 text-ink-gray-5">
				<Shapes class="w-4 h-4 stroke-1.5" />
				<span>
					{{ job.type }}
				</span>
			</div>
			<div class="flex items-center space-x-2 text-ink-gray-5">
				<Calendar class="w-4 h-4 stroke-1.5" />
				<span> {{ __('posted') }} {{ dayjs(job.creation).fromNow() }} </span>
			</div>
		</div>
	</div>
</template>
<script setup>
import { Building2, Calendar, MapPin, Shapes } from 'lucide-vue-next'
import { inject } from 'vue'
import { Avatar } from 'frappe-ui'

const dayjs = inject('$dayjs')
const props = defineProps({
	job: {
		type: Object,
		default: null,
	},
})
</script>
