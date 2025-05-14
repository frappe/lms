<template>
	<div class="">
		<header
			class="sticky top-0 z-10 flex items-center justify-between border-b bg-surface-white px-3 py-2.5 sm:px-5"
		>
			<Breadcrumbs
				class="h-7"
				:items="[{ label: __('Jobs'), route: { name: 'Jobs' } }]"
			/>
			<router-link
				v-if="user.data?.name"
				:to="{
					name: 'JobForm',
					params: {
						jobName: 'new',
					},
				}"
			>
				<Button v-if="!readOnlyMode" variant="solid">
					<template #prefix>
						<Plus class="h-4 w-4" />
					</template>
					{{ __('New Job') }}
				</Button>
			</router-link>
		</header>
		<div>
			<div
				v-if="jobCount"
				class="flex flex-col lg:flex-row space-y-4 lg:space-y-0 lg:items-center justify-between w-full md:w-4/5 mx-auto p-5"
			>
				<div class="text-xl font-semibold text-ink-gray-7 mb-4 md:mb-0">
					{{ __('{0} Open Jobs').format(jobCount) }}
				</div>

				<div
					v-if="jobs.data?.length || jobCount > 0"
					class="grid grid-cols-1 md:grid-cols-3 gap-2"
				>
					<FormControl
						type="text"
						:placeholder="__('Search')"
						v-model="searchQuery"
						class="min-w-40 lg:min-w-0 lg:w-32 xl:w-40"
						@input="updateJobs"
					>
						<template #prefix>
							<Search
								class="w-4 h-4 stroke-1.5 text-ink-gray-5"
								name="search"
							/>
						</template>
					</FormControl>
					<Link
						doctype="Country"
						v-model="country"
						:placeholder="__('Country')"
						class="min-w-40 lg:min-w-0 lg:w-32 xl:w-40"
					/>
					<FormControl
						v-model="jobType"
						type="select"
						:options="jobTypes"
						class="min-w-40 lg:min-w-0 lg:w-32 xl:w-40"
						:placeholder="__('Type')"
						@change="updateJobs"
					/>
				</div>
			</div>
			<div v-if="jobs.data?.length" class="w-full md:w-4/5 mx-auto p-5 pt-0">
				<div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
					<router-link
						v-for="job in jobs.data"
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
			<EmptyState v-else type="Job Openings" />
		</div>
	</div>
</template>
<script setup>
import {
	Button,
	Breadcrumbs,
	call,
	createResource,
	FormControl,
	usePageMeta,
} from 'frappe-ui'
import { Plus, Search } from 'lucide-vue-next'
import { sessionStore } from '../stores/session'
import { inject, computed, ref, onMounted, watch } from 'vue'
import JobCard from '@/components/JobCard.vue'
import Link from '@/components/Controls/Link.vue'
import EmptyState from '@/components/EmptyState.vue'

const user = inject('$user')
const jobType = ref(null)
const { brand } = sessionStore()
const searchQuery = ref('')
const country = ref(null)
const filters = ref({})
const orFilters = ref({})
const jobCount = ref(0)
const readOnlyMode = window.read_only_mode

onMounted(() => {
	let queries = new URLSearchParams(location.search)
	if (queries.has('type')) {
		jobType.value = queries.get('type')
	}
	updateJobs()
	getJobCount()
})

const jobs = createResource({
	url: 'lms.lms.api.get_job_opportunities',
	cache: ['jobs'],
})

const updateJobs = () => {
	updateFilters()
	jobs.update({
		params: {
			filters: filters.value,
			orFilters: orFilters.value,
		},
	})
	jobs.reload()
}

const updateFilters = () => {
	filters.value.status = 'Open'
	filters.value.disabled = 0

	if (jobType.value) {
		filters.value.type = jobType.value
	} else {
		delete filters.value.type
	}

	if (searchQuery.value) {
		orFilters.value = {
			job_title: ['like', `%${searchQuery.value}%`],
			company_name: ['like', `%${searchQuery.value}%`],
			location: ['like', `%${searchQuery.value}%`],
		}
	} else {
		orFilters.value = {}
	}

	if (country.value) {
		filters.value.country = country.value
	} else {
		delete filters.value.country
	}
}

const getJobCount = () => {
	call('frappe.client.get_count', {
		doctype: 'Job Opportunity',
		filters: {
			status: 'Open',
			disabled: 0,
		},
	}).then((data) => {
		jobCount.value = data
	})
}

watch(country, (val) => {
	updateJobs()
})

const jobTypes = computed(() => {
	return [
		'',
		{ label: __('Full Time'), value: 'Full Time' },
		{ label: __('Part Time'), value: 'Part Time' },
		{ label: __('Contract'), value: 'Contract' },
		{ label: __('Freelance'), value: 'Freelance' },
	]
})

usePageMeta(() => {
	return {
		title: __('Jobs'),
		icon: brand.favicon,
	}
})
</script>
