<template>
	<header
		class="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-3 py-2.5 sm:px-5"
	>
		<Breadcrumbs :items="breadcrumbs" />
		<router-link
			:to="{
				name: 'AssignmentForm',
				params: {
					assignmentID: 'new',
				},
			}"
		>
			<Button variant="solid">
				<template #prefix>
					<Plus class="w-4 h-4" />
				</template>
				{{ __('New') }}
			</Button>
		</router-link>
	</header>

	<div v-if="assignments.data?.length" class="md:w-3/4 md:mx-auto py-5 mx-5">
		<ListView
			:columns="assignmentColumns"
			:rows="assignments.data"
			row-key="name"
			:options="{
				showTooltip: false,
				selectable: false,
				getRowRoute: (row) => ({
					name: 'AssignmentForm',
					params: {
						assignmentID: row.name,
					},
				}),
			}"
		>
		</ListView>
		<div class="flex justify-center my-5">
			<Button v-if="assignments.hasNextPage" @click="assignments.next()">
				{{ __('Load More') }}
			</Button>
		</div>
	</div>
	<div
		v-else
		class="text-center p-5 text-gray-600 mt-52 w-3/4 md:w-1/2 mx-auto space-y-2"
	>
		<Pencil class="size-10 mx-auto stroke-1 text-gray-500" />
		<div class="text-xl font-medium">
			{{ __('No assignments found') }}
		</div>
		<div class="leading-5">
			{{
				__(
					'You have not created any assignments yet. To create a new assignment, click on the "New" button above.'
				)
			}}
		</div>
	</div>
</template>
<script setup>
import { Breadcrumbs, Button, createListResource, ListView } from 'frappe-ui'
import { computed, inject } from 'vue'
import { Plus, Pencil } from 'lucide-vue-next'

const user = inject('$user')
const dayjs = inject('$dayjs')

const assignmentFilter = computed(() => {
	if (user.data?.is_moderator) return {}
	return {
		owner: user.data?.name,
	}
})

const assignments = createListResource({
	doctype: 'LMS Assignment',
	fields: ['name', 'title', 'type', 'creation'],
	filters: assignmentFilter,
	orderBy: 'modified desc',
	auto: true,
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
			align: 'center',
		},
		{
			label: __('Created'),
			key: 'creation',
			width: 1,
			align: 'center',
		},
	]
})

const breadcrumbs = computed(() => [
	{
		label: 'Assignments',
		route: { name: 'Assignments' },
	},
])
</script>
