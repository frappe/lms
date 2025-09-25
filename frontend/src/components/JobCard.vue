<template>
	<div
		class="flex flex-col border rounded-md p-3 h-full hover:border-outline-gray-3"
	>
		<div class="flex space-x-4 mb-4">
			<div class="flex flex-col space-y-2 flex-1">
				<div class="text-lg font-semibold text-ink-gray-9">
					{{ job.company_name }}
				</div>
				<span class="font-medium text-ink-gray-7 leading-5">
					{{ job.job_title }}
				</span>
				<div class="flex items-center space-x-1 text-sm text-ink-gray-7">
					<MapPin class="size-3" />
					<span>
						{{ job.location }}{{ job.country ? `, ${job.country}` : '' }}
					</span>
				</div>
				<div
					v-if="job.applicants"
					class="flex items-center space-x-1 text-sm text-ink-gray-7"
				>
					<User class="size-3" />
					<span>
						{{ job.applicants }}
						{{ job.applicants > 1 ? __('applicants') : __('applicant') }}
					</span>
				</div>
			</div>
			<!-- <img :src="job.company_logo" alt="Company Logo" class="size-8  rounded-full object-contain  bg-white" /> -->
		</div>
		<div class="space-x-2 mt-auto">
			<Badge>
				{{ job.type }}
			</Badge>
			<Badge v-if="job.work_mode">
				{{ job.work_mode }}
			</Badge>
			<Badge>
				{{ dayjs(job.creation).fromNow() }}
			</Badge>
		</div>
		<!-- <div
			class="description text-ink-gray-9 text-sm"
			v-html="job.description"
		></div> -->
	</div>
</template>
<script setup>
import { inject } from 'vue'
import { Badge } from 'frappe-ui'
import { MapPin, User } from 'lucide-vue-next'

const dayjs = inject('$dayjs')
const props = defineProps({
	job: {
		type: Object,
		default: null,
	},
})
</script>
<style>
.description {
	display: -webkit-box;
	-webkit-line-clamp: 2;
	-webkit-box-orient: vertical;
	text-overflow: ellipsis;
	width: 100%;
	overflow: hidden;
	margin-top: auto;
	line-height: 1.5;
}
</style>
