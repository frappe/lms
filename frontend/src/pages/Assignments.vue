<template>
	<header
		class="sticky top-0 z-10 flex items-center justify-between border-b bg-surface-white px-3 py-2.5 sm:px-5"
	>
		<Breadcrumbs :items="breadcrumbs" />
		<Button
			v-if="!readOnlyMode"
			variant="solid"
			@click="
				() => {
					assignmentID = 'new'
					showAssignmentForm = true
				}
			"
		>
			<template #prefix>
				<Plus class="w-4 h-4" />
			</template>
			{{ __('New') }}
		</Button>
	</header>

	<div class="md:w-3/4 md:mx-auto py-5 mx-5">
		<div class="flex items-center justify-between mb-5">
			<div
				v-if="assignmentCount"
				class="text-xl font-semibold text-ink-gray-7 mb-4"
			>
				{{ __('{0} Assignments').format(assignmentCount) }}
			</div>
			<div
				v-if="assignments.data?.length || assigmentCount > 0"
				class="grid grid-cols-2 gap-5"
			>
				<FormControl
					v-model="titleFilter"
					:placeholder="__('Search by title')"
				/>
				<FormControl
					v-model="typeFilter"
					type="select"
					:options="assignmentTypes"
					:placeholder="__('Type')"
				/>
			</div>
		</div>
		<ListView
			v-if="assignments.data?.length"
			:columns="assignmentColumns"
			:rows="assignments.data"
			row-key="name"
			:options="{
				showTooltip: false,
				selectable: false,
				onRowClick: (row) => {
					if (readOnlyMode) return
					assignmentID = row.name
					showAssignmentForm = true
				},
			}"
		>
		</ListView>
		<EmptyState v-else type="Assignments" />
		<div
			v-if="assignments.data && assignments.hasNextPage"
			class="flex justify-center my-5"
		>
			<Button @click="assignments.next()">
				{{ __('Load More') }}
			</Button>
		</div>
	</div>
	<AssignmentForm
		v-model="showAssignmentForm"
		v-model:assignments="assignments"
		:assignmentID="assignmentID"
	/>
</template>
<script setup>
import {
	Breadcrumbs,
	Button,
	call,
	createListResource,
	FormControl,
	ListView,
	usePageMeta,
} from 'frappe-ui'
import { computed, inject, onMounted, ref, watch } from 'vue'
import { Plus } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { sessionStore } from '../stores/session'
import AssignmentForm from '@/components/Modals/AssignmentForm.vue'
import EmptyState from '@/components/EmptyState.vue'

const user = inject('$user')
const dayjs = inject('$dayjs')
const titleFilter = ref('')
const typeFilter = ref('')
const showAssignmentForm = ref(false)
const assignmentID = ref('new')
const assignmentCount = ref(0)
const { brand } = sessionStore()
const router = useRouter()
const readOnlyMode = window.read_only_mode

onMounted(() => {
	if (!user.data?.is_moderator && !user.data?.is_instructor) {
		router.push({ name: 'Courses' })
	}
	getAssignmentCount()
	titleFilter.value = router.currentRoute.value.query.title
	typeFilter.value = router.currentRoute.value.query.type
})

watch([titleFilter, typeFilter], () => {
	router.push({
		query: {
			title: titleFilter.value,
			type: typeFilter.value,
		},
	})
	reloadAssignments()
})

const reloadAssignments = () => {
	assignments.update({
		filters: assignmentFilter.value,
	})
	assignments.reload()
}

const assignmentFilter = computed(() => {
	let filters = {}
	if (titleFilter.value) {
		filters.title = ['like', `%${titleFilter.value}%`]
	}
	if (typeFilter.value) {
		filters.type = typeFilter.value
	}
	if (!user.data?.is_moderator) {
		filters.owner = user.data?.email
	}
	return filters
})

const assignments = createListResource({
	doctype: 'LMS Assignment',
	fields: ['name', 'title', 'type', 'creation', 'question'],
	orderBy: 'modified desc',
	cache: ['assignments'],
	transform(data) {
		return data.map((row) => {
			return {
				...row,
				creation: dayjs(row.creation).fromNow(),
			}
		})
	},
})

const assignmentColumns = computed(() => {
	return [
		{
			label: __('Title'),
			key: 'title',
			width: 2,
		},
		{
			label: __('Type'),
			key: 'type',
			width: 1,
			align: 'left',
		},
		{
			label: __('Created'),
			key: 'creation',
			width: 1,
			align: 'right',
		},
	]
})

const getAssignmentCount = () => {
	call('frappe.client.get_count', {
		doctype: 'LMS Assignment',
	}).then((data) => {
		assignmentCount.value = data
	})
}

const assignmentTypes = computed(() => {
	let types = ['', 'Document', 'Image', 'PDF', 'URL', 'Text']
	return types.map((type) => {
		return {
			label: __(type),
			value: type,
		}
	})
})

const breadcrumbs = computed(() => [
	{
		label: 'Assignments',
		route: { name: 'Assignments' },
	},
])

usePageMeta(() => {
	return {
		title: __('Assignments'),
		icon: brand.favicon,
	}
})
</script>
