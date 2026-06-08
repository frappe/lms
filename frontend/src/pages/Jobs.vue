<template>
	<LayoutHeader>
		<template #left-header>
			<Breadcrumbs
				class="h-7"
				:items="[{ label: __('Jobs'), route: { name: 'Jobs' } }]"
			/>
		</template>
		<template #right-header>
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
		</template>
	</LayoutHeader>
	<div class="mx-auto flex min-h-0 w-full flex-1 flex-col">
		<div
			class="mx-auto mb-2 flex w-full flex-col justify-between space-y-4 p-5 lg:flex-row lg:items-center lg:space-y-0"
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
				class="flex flex-col space-y-4 md:flex-row md:items-center md:gap-x-4 md:space-y-0"
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
							<Search class="size-4 stroke-1.5 text-ink-gray-5" name="search" />
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
				<div class="flex gap-4">
					<Select
						v-model="jobType"
						:options="jobTypes"
						class="w-full"
						:placeholder="__('Type')"
						@update:modelValue="updateJobs"
					/>
					<Select
						v-model="workMode"
						:options="workModes"
						class="w-full"
						:placeholder="__('Work Mode')"
						@update:modelValue="updateJobs"
					/>
				</div>
			</div>
		</div>
		<div
			v-if="jobs.data?.length"
			class="mx-auto w-full flex-1 overflow-y-auto p-5 pt-0"
		>
			<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
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
		<div v-else class="flex flex-1 items-center justify-center px-5">
			<EmptyStateLayout name="Job Openings" />
		</div>
		<ListFooter
			v-model="pageLength"
			class="border-t px-3 py-2 sm:px-5"
			:options="{
				rowCount: jobs.data?.length,
				totalCount: jobCount.data ?? 0,
				pageLengthOptions: [40, 80, 160],
			}"
		>
			<template #right>
				<div class="flex items-center">
					<Button
						v-if="jobs.hasNextPage"
						:label="__('Load More')"
						@click="jobs.next()"
					/>
					<div v-if="jobs.hasNextPage" class="mx-3 h-[80%] border-l" />
					<div class="flex items-center gap-1 text-base text-ink-gray-5">
						<div>{{ jobs.data?.length || 0 }}</div>
						<div>{{ __('of') }}</div>
						<div>{{ jobCount.data ?? 0 }}</div>
					</div>
				</div>
			</template>
		</ListFooter>
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
	ListFooter,
	TabButtons,
	usePageMeta,
} from 'frappe-ui'
import { Plus, Search } from 'lucide-vue-next'
import { sessionStore } from '@/stores/session'
import { useSettings } from '@/stores/settings'
import { inject, computed, ref, onMounted, watch } from 'vue'
import JobCard from '@/components/JobCard.vue'
import Link from '@/components/Controls/Link.vue'
import Select from '@/components/Controls/Select.vue'
import EmptyStateLayout from '@/components/Layouts/EmptyStateLayout.vue'
import LayoutHeader from '@/components/Layouts/LayoutHeader.vue'

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

const pageLength = computed({
	get: () => jobs.pageLength,
	set: (value) => {
		jobs.update({ pageLength: value })
		jobs.reload()
	},
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
