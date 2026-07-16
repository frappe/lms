<template>
	<LayoutHeader>
		<template #left-header>
			<Breadcrumbs :items="breadcrumbs" />
		</template>
		<template #right-header>
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
	</LayoutHeader>
	<StudentPrograms v-if="isStudent" />
	<div v-else class="flex min-h-0 flex-1 flex-col p-5 pb-10">
		<div
			class="mb-5 flex flex-col justify-between space-y-4 lg:flex-row lg:items-center lg:space-y-0"
		>
			<div class="text-lg-semibold text-ink-gray-9">
				{{ __('All Programs') }}
			</div>
			<div
				class="flex flex-col space-y-3 lg:flex-row lg:items-center lg:gap-x-4 lg:space-y-0"
			>
				<TabButtons :options="programTabs" v-model="currentTab" class="w-fit" />

				<FormControl
					v-model="title"
					:placeholder="__('Search')"
					type="text"
					class="w-full lg:w-40"
					@input="updatePrograms()"
				>
					<template #prefix>
						<span class="lucide-search size-4 text-ink-gray-5" />
					</template>
				</FormControl>
			</div>
		</div>
		<SkeletonLoader
			v-if="programs.list.loading && !programs.data"
			variant="cards"
			:count="8"
		/>
		<div
			v-else-if="programs.data?.length"
			class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5"
		>
			<div
				v-for="program in programs.data"
				@click="openForm(program.name)"
				class="border rounded-md p-3 hover:border-outline-gray-3 cursor-pointer space-y-2"
			>
				<div class="text-lg-semibold text-ink-gray-9">
					{{ program.name }}
				</div>
				<div class="flex items-center gap-x-2 text-ink-gray-7">
					<span class="lucide-book-open size-4" />
					<span>
						{{ program.course_count }}
						{{ program.course_count == 1 ? __('Course') : __('Courses') }}
					</span>
				</div>
				<div class="flex items-center gap-x-2 text-ink-gray-7">
					<span class="lucide-user size-4" />
					<span>
						{{ program.member_count || 0 }}
						{{ program.member_count == 1 ? __('member') : __('members') }}
					</span>
				</div>
			</div>
		</div>
		<div v-else class="flex-1">
			<EmptyStateLayout name="Programs" icon="lucide-graduation-cap" />
		</div>
	</div>
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
	FormControl,
	TabButtons,
	usePageMeta,
	createListResource,
} from 'frappe-ui'
import { computed, inject, onMounted, ref, watch } from 'vue'

import { sessionStore } from '@/stores/session'
import ProgramForm from '@/pages/Programs/ProgramForm.vue'
import SkeletonLoader from '@/components/SkeletonLoader.vue'
import EmptyStateLayout from '@/components/Layouts/EmptyStateLayout.vue'
import LayoutHeader from '@/components/Layouts/LayoutHeader.vue'
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
