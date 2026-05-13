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
				v-if="
					user.data?.name && settings.data?.allow_job_posting && !readOnlyMode
				"
				:to="{
					name: 'JobForm',
					params: {
						jobName: 'new',
					},
				}"
			>
				<Button variant="solid">
					<template #prefix>
						<Plus class="size-4 stroke-1.5" />
					</template>
					{{ __('Create') }}
				</Button>
			</router-link>
		</header>
		<div>
			<div
				class="flex flex-col lg:flex-row space-y-4 lg:space-y-0 lg:items-center justify-between w-full mx-auto mb-2 p-5"
			>
				<div class="flex items-center justify-between">
					<div class="text-lg font-semibold text-ink-gray-9 md:mb-0">
						{{ __('{0} {1} Jobs').format(jobCount.data ?? 0, activeTab) }}
					</div>
					<TabButtons
						v-if="tabs.length > 1"
						v-model="activeTab"
						:buttons="tabs"
						class="lg:hidden"
						@change="updateJobs"
					/>
				</div>

				<div
					class="flex flex-col md:flex-row md:items-center md:gap-x-4 space-y-4 md:space-y-0"
				>
					<TabButtons
						v-if="tabs.length > 1"
						v-model="activeTab"
						:buttons="tabs"
						class="hidden lg:block"
						@change="updateJobs"
					/>
					<div class="flex items-center gap-x-4">
						<FormControl
							type="text"
							:placeholder="__('Search')"
							v-model="searchQuery"
							class="w-full"
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
							v-if="user.data"
							doctype="Country"
							v-model="country"
							:placeholder="__('Country')"
							class="w-full"
						/>
					</div>
					<div class="grid grid-cols-2 gap-4">
						<FormControl
							v-model="jobType"
							type="select"
							:options="jobTypes"
							class="w-full min-w-32"
							:placeholder="__('Type')"
							@update:modelValue="updateJobs"
						/>
						<FormControl
							v-model="workMode"
							type="select"
							:options="workModes"
							class="w-full min-w-32"
							:placeholder="__('Work Mode')"
							@update:modelValue="updateJobs"
						/>
					</div>
				</div>
			</div>
			<div
				v-if="jobs.data?.length"
				class="w-full h-[61vh] lg:h-[78vh] overflow-y-auto mx-auto p-5 pt-0"
			>
				<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
			<div v-else class="h-[32vh] lg:h-[50vh] px-5">
				<EmptyStateLayout name="Job Openings" />
			</div>
			<div class="flex items-center justify-end gap-x-3 border-t pt-3 px-5">
				<Button v-if="jobs.hasNextPage" @click="jobs.next()">
					{{ __('Load More') }}
				</Button>
				<div v-if="jobs.hasNextPage" class="h-8 border-s"></div>
				<div class="text-ink-gray-5">
					{{ jobs.data?.length }} {{ __('of') }}
					{{ jobCount.data ?? 0 }}
				</div>
			</div>
		</div>
	</div>
</template>
<script setup>
import {
	Button,
	Breadcrumbs,
	call,
	createListResource,
	createResource,
	FormControl,
	TabButtons,
	usePageMeta,
} from 'frappe-ui'
import { Plus, Search } from 'lucide-vue-next'
import { sessionStore } from '@/stores/session'
import { useSettings } from '@/stores/settings'
import { inject, computed, ref, onMounted, watch } from 'vue'
import JobCard from '@/components/JobCard.vue'
import Link from '@/components/Controls/Link.vue'
import EmptyStateLayout from '@/components/Layouts/EmptyStateLayout.vue'

const user = inject('$user')
const jobType = ref(null)
const workMode = ref(null)
const { brand } = sessionStore()
const { settings } = useSettings()
const searchQuery = ref('')
const country = ref(null)
const filters = ref({})
const orFilters = ref({})
const closedJobs = ref(0)
const activeTab = ref('Open')
const readOnlyMode = window.read_only_mode

onMounted(() => {
	getClosedJobCount()
	setFiltersFromURL()
	updateJobs()
})

const isModerator = computed(() => {
	return user.data?.is_moderator
})

const getClosedJobCount = () => {
	if (!user.data?.name) return

	const filters = {
		status: 'Closed',
	}

	if (!isModerator.value) {
		filters.owner = user.data?.name
	}

	call('frappe.client.get_count', {
		doctype: 'Job Opportunity',
		filters: filters,
	}).then((count) => {
		closedJobs.value = count
	})
}

const jobCount = createResource({
	url: 'lms.lms.api.get_job_opportunities_count',
	cache: ['jobCount'],
	makeParams() {
		return {
			filters: filters.value,
			or_filters: orFilters.value,
		}
	},
})

const setFiltersFromURL = () => {
	let queries = new URLSearchParams(location.search)
	if (queries.has('type')) {
		jobType.value = queries.get('type')
	}
	if (queries.has('work_mode')) {
		workMode.value = queries.get('work_mode')
	}
}

const jobs = createListResource({
	url: 'lms.lms.api.get_job_opportunities',
	doctype: 'Job Opportunity',
	start: 0,
	cache: ['jobs'],
	pageLength: 40,
})

const updateJobs = () => {
	updateFilters()
	jobs.update({
		filters: filters.value,
		orFilters: orFilters.value,
	})
	jobs.reload()
	jobCount.reload()
}

const updateFilters = () => {
	filters.value.status = activeTab.value === 'Open' ? 'Open' : 'Closed'
	updateJobTypeFilter()
	updateWorkModeFilter()
	updateSearchQueryFilter()
	updateCountryFilter()
}

const updateJobTypeFilter = () => {
	if (jobType.value && jobType.value !== ' ') {
		filters.value.type = jobType.value
	} else {
		delete filters.value.type
	}
}

const updateWorkModeFilter = () => {
	if (workMode.value && workMode.value !== ' ') {
		filters.value.work_mode = workMode.value
	} else {
		delete filters.value.work_mode
	}
}

const updateSearchQueryFilter = () => {
	if (searchQuery.value) {
		orFilters.value = {
			job_title: ['like', `%${searchQuery.value}%`],
			company_name: ['like', `%${searchQuery.value}%`],
			location: ['like', `%${searchQuery.value}%`],
		}
	} else {
		orFilters.value = {}
	}
}

const updateCountryFilter = () => {
	if (country.value) {
		filters.value.country = country.value
	} else {
		delete filters.value.country
	}
}

watch(activeTab, (val) => {
	updateJobs()
})

watch(country, (val) => {
	updateJobs()
})

const tabs = computed(() => {
	const tabsArray = [
		{
			label: __('Open'),
		},
	]

	if (closedJobs.value) {
		tabsArray.push({
			label: __('Closed'),
		})
	}

	return tabsArray
})

const jobTypes = computed(() => {
	return [
		{ label: ' ', value: ' ' },
		{ label: __('Full Time'), value: 'Full Time' },
		{ label: __('Part Time'), value: 'Part Time' },
		{ label: __('Contract'), value: 'Contract' },
		{ label: __('Freelance'), value: 'Freelance' },
	]
})

const workModes = computed(() => {
	return [
		{ label: ' ', value: ' ' },
		{ label: __('On-site'), value: 'On-site' },
		{ label: __('Hybrid'), value: 'Hybrid' },
		{ label: __('Remote'), value: 'Remote' },
	]
})

usePageMeta(() => {
	return {
		title: __('Jobs'),
		icon: brand.favicon,
	}
})
</script>
