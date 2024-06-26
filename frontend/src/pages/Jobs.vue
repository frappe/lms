<template>
	<div class="">
		<header
			class="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-3 py-2.5 sm:px-5"
		>
			<Breadcrumbs
				class="h-7"
				:items="[{ label: __('Jobs'), route: { name: 'Jobs' } }]"
			/>
			<div class="flex">
				<router-link
					v-if="user.data?.name"
					:to="{
						name: 'JobCreation',
						params: {
							jobName: 'new',
						},
					}"
				>
					<Button variant="solid">
						<template #prefix>
							<Plus class="h-4 w-4" />
						</template>
						{{ __('New Job') }}
					</Button>
				</router-link>
			</div>
		</header>
		<div v-if="jobs.data?.length">
			<div class="divide-y lg:w-3/4 mx-auto p-5">
				<div v-for="job in jobs.data">
					<router-link
						:to="{
							name: 'JobDetail',
							params: { job: job.name },
						}"
						:key="job.name"
					>
						<JobCard :job="job" />
					</router-link>
				</div>
			</div>
		</div>
		<div v-else class="text-gray-700 italic p-5 w-fit mx-auto">
			{{ __('No jobs posted') }}
		</div>
	</div>
</template>
<script setup>
import { Button, Breadcrumbs, createResource } from 'frappe-ui'
import { Plus } from 'lucide-vue-next'
import { inject, computed } from 'vue'
import JobCard from '@/components/JobCard.vue'
import { updateDocumentTitle } from '@/utils'

const user = inject('$user')

const jobs = createResource({
	url: 'lms.lms.api.get_job_opportunities',
	cache: ['jobs'],
	auto: true,
})

const pageMeta = computed(() => {
	return {
		title: 'Jobs',
		description: 'An open job board for the community',
	}
})

updateDocumentTitle(pageMeta)
</script>
