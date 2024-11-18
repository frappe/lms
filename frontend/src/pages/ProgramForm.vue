<template>
	<header
		class="sticky top-0 z-10 flex flex-col md:flex-row md:items-center justify-between border-b bg-white px-3 py-2.5 sm:px-5"
	>
		<Breadcrumbs :items="breadbrumbs" />
		<Button variant="solid">
			{{ __('Save') }}
		</Button>
	</header>
	<div v-if="program.doc" class="w-1/2 mx-auto pt-10 space-y-5">
		<FormControl :label="__('Title')" v-model="program.doc.title" />
		<div>
			<div>
				<div class="font-semibold">
					{{ __('Program Courses') }}
				</div>
				<div></div>
			</div>
			<ListView
				v-if="program.doc.program_courses.length"
				:columns="courseColumns"
				:rows="program.doc.program_courses"
				row-key="name"
				:options="{ showTooltip: false, selectable: false }"
			>
				<ListHeader
					class="mb-2 grid items-center space-x-4 rounded bg-gray-100 p-2"
				>
					<ListHeaderItem :item="item" v-for="item in courseColumns">
					</ListHeaderItem>
				</ListHeader>
				<ListRows>
					<ListRow :row="row" />
				</ListRows>
			</ListView>
		</div>
	</div>
</template>
<script setup>
import {
	Breadcrumbs,
	Button,
	createDocumentResource,
	FormControl,
	ListView,
	ListRows,
	ListRow,
	ListHeader,
	ListHeaderItem,
} from 'frappe-ui'
import { computed } from 'vue'

const props = defineProps({
	programName: {
		type: String,
		required: true,
	},
})

const program = createDocumentResource({
	doctype: 'LMS Program',
	name: props.programName,
	auto: true,
	cache: ['program', props.programName],
})

console.log(program)

const courseColumns = computed(() => [
	{
		label: 'Course',
		key: 'course_title',
		width: '2',
	},
])

const breadbrumbs = computed(() => {
	return [
		{
			label: 'Programs',
			to: { name: 'Programs' },
		},
		{
			label: props.programName === 'new' ? 'New Program' : props.programName,
		},
	]
})
</script>
