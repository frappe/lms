<template>
	<template v-if="isStudent">
		<PageHeader :breadcrumbs="breadcrumbs" />
		<StudentPrograms />
	</template>

	<ListPage
		v-else
		:breadcrumbs="breadcrumbs"
		:title="__('All Programs')"
		:rows="programs.data || []"
		:total-count="programCount"
		:loading="programs.list.loading || reloading"
		:has-next-page="programs.hasNextPage"
		v-model:page-length="pageLength"
		empty-name="Programs"
		empty-icon="lucide-graduation-cap"
		@load-more="programs.next()"
	>
		<template #actions>
			<Button
				v-if="canCreateProgram()"
				variant="solid"
				@click="openForm('new')"
			>
				<template #prefix>
					<span class="lucide-plus size-4" />
				</template>
				{{ __('Create') }}
			</Button>
		</template>

		<template #filters>
			<TabButtons
				:options="programTabs"
				v-model="currentTab"
				class="!w-fit shrink-0"
			/>
			<FormControl
				v-model="title"
				:placeholder="__('Search')"
				:aria-label="__('Search')"
				type="text"
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

	<router-view
		:key="String($route.params.programName || '')"
		@saved="updatePrograms"
	/>
</template>
<script setup>
import {
	Button,
	createResource,
	FormControl,
	TabButtons,
	usePageMeta,
	createListResource,
} from 'frappe-ui'
import { computed, inject, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useDebounceFn } from '@vueuse/core'

import { sessionStore } from '@/stores/session'
import PageHeader from '@/components/Layouts/PageHeader.vue'
import ListPage from '@/components/Layouts/ListPage.vue'
import StudentPrograms from '@/pages/Programs/StudentPrograms.vue'
import { openFormRoute } from '@/composables/useFormRoute'

const { brand } = sessionStore()
const user = inject('$user')
const router = useRouter()
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

// `list.loading` goes false mid-request: the aborted fetch's tail resolves
// after the new reload() has started and clears the flag for it, so the empty
// state flashes until the reload lands.
const reloading = ref(false)

const reloadPrograms = async () => {
	reloading.value = true
	try {
		await programs.reload()
	} finally {
		reloading.value = false
	}
}

const pageLength = computed({
	get: () => programs.pageLength,
	set: (value) => {
		// reload() ignores the new size while start > 0: it refetches rows 0..N
		// of the pages already loaded and then restores start. Resetting start
		// makes the chosen size the size that is actually requested.
		programs.update({ pageLength: value, start: 0 })
		reloadPrograms()
	},
})

const setFiltersFromQuery = () => {
	let queries = new URLSearchParams(location.search)
	title.value = queries.get('title') || ''
}

const updatePrograms = () => {
	updateFilters()
	// createResource keeps no request sequence: every response assigns `data`,
	// so a slow fetch for filters the user has already left repaints the list
	// with the wrong programs seconds later. Cancel it first: an aborted fetch
	// is swallowed and never reaches the list.
	programs.list.abort()
	programs.update({
		filters: filters.value,
	})
	reloadPrograms()
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
	// Carry the existing state forward rather than replacing it with `{}`: this
	// runs on mount, and a form opened at a child route of this page keeps its
	// "we pushed this entry" marker in history.state — wiping it degrades the
	// form's close from a pop into a replace after a reload. Passing `{}` also
	// left vue-router unable to re-seed its own `position` (a truthy state is
	// taken as its own), which makes every later pop delta NaN.
	history.replaceState(history.state, '', `${location.pathname}${queryString}`)
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

// openFormRoute, not a bare router.push: it stamps the history entry so the
// form knows Back should close it rather than eject the user out of the app.
const openForm = (programName) => {
	if (!canCreateProgram()) return
	openFormRoute(router, {
		name: 'ProgramForm',
		params: { programName: programName || 'new' },
	})
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
