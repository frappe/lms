<template>
	<header
		class="sticky top-0 z-10 flex flex-col md:flex-row md:items-center justify-between border-b bg-white px-3 py-2.5 sm:px-5"
	>
		<Breadcrumbs :items="breadbrumbs" />
		<Button variant="solid" @click="showDialog = true">
			<template #prefix>
				<Plus class="w-4 h-4" />
			</template>
			{{ __('New Program') }}
		</Button>
	</header>
	<div class="pt-5 px-5">
		<div v-if="programs.data?.length">
			<ListView
				:columns="programColumns"
				:rows="programs.data"
				row-key="name"
				:options="{ showTooltip: false, selectable: false }"
			>
				<ListHeader
					class="mb-2 grid items-center space-x-4 rounded bg-gray-100 p-2"
				>
					<ListHeaderItem :item="item" v-for="item in programColumns">
					</ListHeaderItem>
				</ListHeader>
				<ListRows>
					<router-link
						v-for="row in programs.data"
						:to="{
							name: 'ProgramForm',
							params: {
								programName: row.name,
							},
						}"
					>
						<ListRow :row="row" />
					</router-link>
				</ListRows>
			</ListView>
		</div>
		<div
			v-else
			class="text-center p-5 text-gray-600 mt-52 w-3/4 md:w-1/2 mx-auto space-y-2"
		>
			<Route class="size-10 mx-auto stroke-1 text-gray-500" />
			<div class="text-xl font-medium">
				{{ __('No programs found') }}
			</div>
			<div class="leading-5">
				{{
					__(
						'Program lets you create learning paths and assign them to your students. To create one, click on the "New Program" button above.'
					)
				}}
			</div>
		</div>
	</div>

	<Dialog
		v-model="showDialog"
		:options="{
			title: __('New Program'),
			actions: [
				{
					label: __('Create'),
					variant: 'solid',
					onClick: () => createProgram(close),
				},
			],
		}"
	>
		<template #body-content>
			<FormControl :label="__('Title')" v-model="title" />
		</template>
	</Dialog>
</template>
<script setup>
import {
	Breadcrumbs,
	Button,
	createListResource,
	Dialog,
	FormControl,
	ListView,
	ListRows,
	ListRow,
	ListHeader,
	ListHeaderItem,
} from 'frappe-ui'
import { computed, inject, onMounted, ref } from 'vue'
import { Plus, Route } from 'lucide-vue-next'
import { useRouter } from 'vue-router'

const user = inject('$user')
const router = useRouter()
const showDialog = ref(false)
const title = ref('')

onMounted(() => {
	if (!user.data?.is_moderator) {
		router.push({ name: 'Courses' })
	}
})

const programs = createListResource({
	doctype: 'LMS Program',
	fields: ['title', 'name', 'program_courses'],
	auto: true,
	cache: 'programs',
	transform(data) {
		return data.map((program) => {
			console.log(program)
			program.program_courses = program.program_courses?.length
			return program
		})
	},
})

const createProgram = async (close) => {
	programs.insert.submit(
		{
			title: title.value,
		},
		{
			onSuccess(data) {
				showDialog.value = false
				router.push({ name: 'ProgramForm', params: { programName: data.name } })
			},
		}
	)
}

const breadbrumbs = computed(() => [
	{
		label: 'Programs',
		route: {
			name: 'Programs',
		},
	},
])

const programColumns = computed(() => {
	return [
		{
			label: __('Title'),
			key: 'title',
			width: 2,
		},
		{
			label: __('Courses'),
			key: 'program_courses',
			width: 1,
			align: 'center',
		},
		{
			label: __('Members'),
			key: 'program_members',
			width: 1,
			align: 'center',
		},
	]
})
</script>
