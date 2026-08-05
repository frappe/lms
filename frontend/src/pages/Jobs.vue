<template>
	<ListPage
		:breadcrumbs="breadcrumbs"
		:title="__('{0} {1} Jobs').format(jobCount.data ?? 0, activeTab)"
		:rows="jobs.data || []"
		:total-count="jobCount.data ?? 0"
		:loading="jobs.list.loading"
		:has-next-page="jobs.hasNextPage"
		v-model:page-length="pageLength"
		empty-name="Job Openings"
		empty-icon="lucide-briefcase"
		@load-more="jobs.next()"
	>
		<template #actions>
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
						<span class="lucide-plus size-4" />
					</template>
					{{ __('Create') }}
				</Button>
			</router-link>
		</template>

		<template #filters>
			<TabButtons
				v-if="tabs.length > 1"
				v-model="activeTab"
				:options="tabs"
				class="!w-fit shrink-0"
				@change="updateJobs"
			/>
			<FormControl
				type="text"
				:placeholder="__('Search')"
				:aria-label="__('Search jobs')"
				v-model="searchQuery"
				@input="updateJobs"
			>
				<template #prefix>
					<span class="lucide-search size-4 text-ink-gray-5" />
				</template>
			</FormControl>
			<Link
				v-if="user.data"
				doctype="Country"
				v-model="country"
				:placeholder="__('Country')"
			/>
			<Select
				v-model="jobType"
				:options="jobTypes"
				:placeholder="__('Type')"
				@update:modelValue="updateJobs"
			/>
			<Select
				v-model="workMode"
				:options="workModes"
				:placeholder="__('Work Mode')"
				@update:modelValue="updateJobs"
			/>
		</template>

		<template #card="{ row }">
			<router-link
				:to="{
					name: 'JobDetail',
					params: { job: row.name },
				}"
			>
				<JobCard :job="row" />
			</router-link>
		</template>
	</ListPage>
</template>
<script setup>
import {
	Button,
	call,
	createListResource,
	createResource,
	FormControl,
	TabButtons,
	usePageMeta,
} from 'frappe-ui'
import { sessionStore } from '@/stores/session'
import { useSettings } from '@/stores/settings'
import { inject, computed, ref, onMounted, watch } from 'vue'
import JobCard from '@/components/JobCard.vue'
import Link from '@/components/Controls/Link.vue'
import Select from '@/components/Controls/Select.vue'
import ListPage from '@/components/Layouts/ListPage.vue'

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
	pageLength: 24,
})

const pageLength = computed({
	get: () => jobs.pageLength,
	set: (value) => {
		// reload() ignores a new pageLength while start > 0: it refetches the
		// already loaded rows instead, so paging must be reset for it to apply.
		jobs.update({ pageLength: value, start: 0 })
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

watch(activeTab, () => {
	updateJobs()
})

watch(country, () => {
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

const breadcrumbs = computed(() => [
	{ label: __('Jobs'), route: { name: 'Jobs' } },
])

usePageMeta(() => {
	return {
		title: __('Jobs'),
		icon: brand.favicon,
	}
})
</script>
