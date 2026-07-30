<template>
	<!-- A student sees their own enrolled/published split, which is not a
	     filtered list page, so it keeps its own chrome. -->
	<template v-if="isStudent">
		<LayoutHeader>
			<template #left-header>
				<Breadcrumbs :items="breadcrumbs" />
			</template>
		</LayoutHeader>
		<StudentPrograms />
	</template>

	<ListPage
		v-else
		:breadcrumbs="breadcrumbs"
		:title="__('All Programs')"
		:rows="programs.data || []"
		:total-count="programCount"
		:loading="programs.list.loading"
		:has-next-page="programs.hasNextPage"
		v-model:page-length="pageLength"
		empty-name="Programs"
		empty-icon="lucide-graduation-cap"
		@load-more="programs.next()"
	>
		<template #actions>
			<Button
				v-if="canCreateProgram()"
				@click="openForm('new')"
				variant="solid"
			>
				<template #prefix>
					<span class="lucide-plus size-4" />
				</template>
				{{ __('Create') }}
			</Button>
		</template>

		<template #tabs>
			<TabButtons :options="programTabs" v-model="currentTab" class="w-fit" />
		</template>

		<template #filters>
			<FormControl
				v-model="title"
				:placeholder="__('Search')"
				:aria-label="__('Search')"
				type="text"
				class="w-full lg:w-40"
				@input="debouncedUpdatePrograms()"
			>
				<template #prefix>
					<span class="lucide-search size-4 text-ink-gray-5" />
				</template>
			</FormControl>
		</template>

		<template #card="{ row }">
			<button
				type="button"
				@click="openForm(row.name)"
				class="block w-full cursor-pointer space-y-2 rounded-md border p-3 text-start hover:border-outline-gray-3"
			>
				<div class="text-lg-semibold text-ink-gray-9">
					{{ row.name }}
				</div>
				<div class="flex items-center gap-x-2 text-ink-gray-7">
					<span class="lucide-book-open size-4" />
					<span>
						{{ row.course_count }}
						{{ row.course_count == 1 ? __('Course') : __('Courses') }}
					</span>
				</div>
				<div class="flex items-center gap-x-2 text-ink-gray-7">
					<span class="lucide-user size-4" />
					<span>
						{{ row.member_count || 0 }}
						{{ row.member_count == 1 ? __('member') : __('members') }}
					</span>
				</div>
			</button>
		</template>
	</ListPage>

	<ProgramForm
		v-model="showForm"
		:programName="currentProgram"
		v-model:programs="programs"
	/>
</template>
<script setup>
import {
	Breadcrumbs,
	Button,
	createResource,
	FormControl,
	TabButtons,
	usePageMeta,
	createListResource,
} from 'frappe-ui'
import { computed, inject, onMounted, ref, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'

import { sessionStore } from '@/stores/session'
import ProgramForm from '@/pages/Programs/ProgramForm.vue'
import LayoutHeader from '@/components/Layouts/LayoutHeader.vue'
import ListPage from '@/components/Layouts/ListPage.vue'
import StudentPrograms from '@/pages/Programs/StudentPrograms.vue'

const { brand } = sessionStore()
const user = inject('$user')
const showForm = ref(false)
const currentProgram = ref(null)
const readOnlyMode = window.read_only_mode
const title = ref('')
const currentTab = ref('published')
const filters = ref({})

onMounted(() => {
	if (!user.data) {
		window.location.href = '/login'
	}
	if (user.data?.is_moderator || user.data?.is_instructor) {
		setFiltersFromQuery()
		updatePrograms()
	}
})

const programs = createListResource({
	doctype: 'LMS Program',
	cache: ['program'],
	fields: [
		'name',
		'title',
		'member_count',
		'course_count',
		'published',
		'enforce_course_order',
	],
	auto: false,
	orderBy: 'creation desc',
	pageLength: 24,
})

const pageLength = computed({
	get: () => programs.pageLength,
	set: (value) => {
		// reload() ignores the new size while start > 0: it refetches rows 0..N
		// of the pages already loaded and then restores start. Resetting start
		// makes the chosen size the size that is actually requested.
		programs.update({ pageLength: value, start: 0 })
		programs.reload()
	},
})

const setFiltersFromQuery = () => {
	let queries = new URLSearchParams(location.search)
	title.value = queries.get('title') || ''
}

const updatePrograms = () => {
	updateFilters()
	programs.update({
		filters: filters.value,
	})
	programs.reload()
	getProgramCount()
}

// @input fires on every keystroke, so an undebounced search costs one list
// fetch and one count fetch per character typed.
const debouncedUpdatePrograms = useDebounceFn(updatePrograms, 300)

// LMS Program is a plain doctype filtered by plain fields, so the footer can
// say how many programs the filters actually match.
const programCountResource = createResource({
	url: 'frappe.client.get_count',
	makeParams: () => ({
		doctype: 'LMS Program',
		filters: filters.value,
	}),
	onError: (error) => {
		console.error(error)
	},
})

const programCount = computed(() => programCountResource.data || 0)

const getProgramCount = () => {
	// Same sequencing hazard as the list: nothing orders the responses, so a
	// slow count for filters the user has left would overwrite the current
	// total. An aborted fetch is swallowed and never assigns data.
	programCountResource.abort()
	programCountResource.submit()
}

const updateFilters = () => {
	updateTitleFilter()
	updateTabFilter()
	setQueryParams()
}

const updateTitleFilter = () => {
	if (title.value) {
		filters.value['title'] = ['like', `%${title.value}%`]
	} else {
		delete filters.value['title']
	}
}

const updateTabFilter = () => {
	if (currentTab.value == 'unpublished') {
		filters.value['published'] = 0
	} else {
		filters.value['published'] = 1
	}
}

const setQueryParams = () => {
	let queries = new URLSearchParams(location.search)
	if (title.value) {
		queries.set('title', title.value)
	} else {
		queries.delete('title')
	}

	let queryString = ''
	if (queries.toString()) {
		queryString = `?${queries.toString()}`
	}
	history.replaceState({}, '', `${location.pathname}${queryString}`)
}

const programTabs = computed(() => [
	{
		label: __('Published'),
		value: 'published',
	},
	{
		label: __('Unpublished'),
		value: 'unpublished',
	},
])

watch(currentTab, () => {
	updatePrograms()
})

const canCreateProgram = () => {
	if (readOnlyMode) return false
	if (user.data?.is_moderator || user.data?.is_instructor) return true
	return false
}

const openForm = (programName) => {
	if (!canCreateProgram()) return
	currentProgram.value = programName
	showForm.value = true
}

const isStudent = computed(() => {
	return user.data?.is_student || false
})

const breadcrumbs = computed(() => [
	{
		label: __('Programs'),
	},
])

usePageMeta(() => {
	return {
		title: __('Programs'),
		icon: brand.favicon,
	}
})
</script>
