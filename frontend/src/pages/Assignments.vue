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
				<Plus class="size-4 stroke-1.5" />
			</template>
			{{ __('Create') }}
		</Button>
	</header>

	<div class="py-5 mx-5">
		<div class="flex items-center justify-between mb-5">
			<div class="text-lg font-semibold text-ink-gray-9">
				{{ __('{0} Assignments').format(assignments.data?.length) }}
			</div>
			<div class="grid grid-cols-2 gap-5">
				<FormControl
					v-model="titleFilter"
					:placeholder="__('Search by Title')"
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
				selectable: true,
				onRowClick: (row) => {
					if (readOnlyMode) return
					assignmentID = row.name
					showAssignmentForm = true
				},
			}"
			class="h-[79vh] border-b"
		>
			<ListHeader
				class="mb-2 grid items-center rounded bg-surface-white border-b rounded-none p-2"
			>
				<ListHeaderItem :item="item" v-for="item in assignmentColumns">
					<template #prefix="{ item }">
						<FeatherIcon :name="item.icon?.toString()" class="h-4 w-4" />
					</template>
				</ListHeaderItem>
			</ListHeader>
			<ListRows>
				<ListRow
					v-for="row in assignments.data"
					:row="row"
					class="hover:bg-surface-gray-2"
				>
					<template #default="{ column, item }">
						<ListRowItem :item="row[column.key]" :align="column.align">
							<div v-if="column.key == 'show_answers'">
								<FormControl
									type="checkbox"
									v-model="row[column.key]"
									:disabled="true"
								/>
							</div>
							<div
								v-else-if="column.key == 'modified'"
								class="text-sm text-ink-gray-5"
							>
								{{ row[column.key] }}
							</div>
							<div v-else>
								{{ row[column.key] }}
							</div>
						</ListRowItem>
					</template>
				</ListRow>
			</ListRows>
			<ListSelectBanner class="bottom-50">
				<template #actions="{ unselectAll, selections }">
					<div class="flex gap-2">
						<Button
							variant="ghost"
							@click="deleteAssignment(selections, unselectAll)"
						>
							<FeatherIcon name="trash-2" class="h-4 w-4 stroke-1.5" />
						</Button>
					</div>
				</template>
			</ListSelectBanner>
		</ListView>
		<EmptyState v-else type="Assignments" />
		<div class="flex items-center justify-end space-x-3 mt-3">
			<Button v-if="assignments.hasNextPage" @click="assignments.next()">
				{{ __('Load More') }}
			</Button>
			<div v-if="assignments.hasNextPage" class="h-8 border-l"></div>
			<div class="text-ink-gray-5">
				{{ assignments.data?.length }} {{ __('of') }}
				{{ totalAssignments.data }}
			</div>
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
	createResource,
	FormControl,
	ListView,
	ListHeader,
	ListHeaderItem,
	ListRows,
	ListRow,
	ListRowItem,
	ListSelectBanner,
	FeatherIcon,
	toast,
	usePageMeta,
} from 'frappe-ui'
import { computed, inject, onMounted, ref, watch } from 'vue'
import { Plus } from 'lucide-vue-next'
import { useRouter, useRoute } from 'vue-router'
import { sessionStore } from '../stores/session'
import AssignmentForm from '@/components/Modals/AssignmentForm.vue'
import EmptyState from '@/components/EmptyState.vue'

const user = inject('$user')
const dayjs = inject('$dayjs')
const titleFilter = ref('')
const typeFilter = ref('')
const showAssignmentForm = ref(false)
const assignmentID = ref('new')
const { brand } = sessionStore()
const router = useRouter()
const route = useRoute()
const readOnlyMode = window.read_only_mode

onMounted(() => {
	if (!user.data?.is_moderator && !user.data?.is_instructor) {
		router.push({ name: 'Courses' })
	}
	if (route.query.new === 'true') {
		assignmentID.value = 'new'
		showAssignmentForm.value = true
	}
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
	totalAssignments.update({
		filters: assignmentFilter.value,
	})
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
	if (typeFilter.value && typeFilter.value.trim() !== '') {
		filters.type = typeFilter.value
	}
	return filters
})

const assignments = createListResource({
	doctype: 'LMS Assignment',
	fields: ['name', 'title', 'type', 'modified', 'question', 'course'],
	orderBy: 'modified desc',
	cache: ['assignments'],
	transform(data) {
		return data.map((row) => {
			return {
				...row,
				modified: dayjs(row.modified).format('DD MMM YYYY'),
			}
		})
	},
})

const totalAssignments = createResource({
	url: 'frappe.client.get_count',
	params: {
		doctype: 'LMS Assignment',
		filters: assignmentFilter.value,
	},
	auto: true,
	cache: ['assignments_count', user.data?.name],
	onError(err) {
		toast.error(err.messages?.[0] || err)
		console.error(err)
	},
})

const assignmentColumns = computed(() => {
	return [
		{
			label: __('Title'),
			key: 'title',
			width: 1,
			icon: 'file-text',
		},
		{
			label: __('Type'),
			key: 'type',
			width: 1,
			align: 'left',
			icon: 'tag',
		},
		{
			label: __('Modified'),
			key: 'modified',
			width: 1,
			align: 'right',
			icon: 'clock',
		},
	]
})

const assignmentTypes = computed(() => {
	let types = [' ', 'Document', 'Image', 'PDF', 'URL', 'Text']
	return types.map((type) => {
		return {
			label: __(type),
			value: type,
		}
	})
})

const deleteAssignment = (selections, unselectAll) => {
	Array.from(selections).forEach(async (assignmentName) => {
		await assignments.delete.submit(assignmentName)
	})
	unselectAll()
	toast.success(__('Assignments deleted successfully'))
}

const breadcrumbs = computed(() => [
	{
		label: __('Assignments'),
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
