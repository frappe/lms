<template>
	<LayoutHeader>
		<template #left-header>
			<Breadcrumbs :items="breadcrumbs" />
		</template>
		<template #right-header>
			<router-link
				v-if="exercises.data?.length"
				class="hidden md:block"
				:to="{
					name: 'ProgrammingExerciseSubmissions',
				}"
			>
				<Button>
					<template #prefix>
						<ClipboardList class="size-4 stroke-1.5" />
					</template>
					{{ __('Check All Submissions') }}
				</Button>
			</router-link>
			<Button
				v-if="!readOnlyMode"
				variant="solid"
				@click="
					() => {
						exerciseID = 'new'
						showForm = true
					}
				"
			>
				<template #prefix>
					<Plus class="size-4 stroke-1.5" />
				</template>
				{{ __('Create') }}
			</Button>
		</template>
	</LayoutHeader>
	<div class="flex min-h-0 flex-1 flex-col pt-5">
		<div
			class="mb-5 flex flex-col justify-between gap-y-4 px-5 sm:flex-row sm:items-center"
		>
			<div class="text-lg font-semibold text-ink-gray-9">
				{{ __('{0} Exercises').format(exercises.data?.length) }}
			</div>
			<div class="flex flex-col gap-3 sm:gap-5 md:flex-row">
				<FormControl
					v-model="titleFilter"
					:placeholder="__('Search by Title')"
					@input="updateList"
				/>
				<Select
					v-model="languageFilter"
					:options="languages"
					:placeholder="__('Type')"
					@update:modelValue="updateList"
				/>
			</div>
		</div>

		<ListView
			v-if="exercises.data?.length"
			:columns="columns"
			:rows="exercises.data"
			row-key="name"
			:options="{
				showTooltip: false,
				selectable: true,
				onRowClick: (row: any) => {
					if (readOnlyMode) return
					exerciseID = row.name
					showForm = true
				},
			}"
			class="flex-1 overflow-y-auto px-5"
		>
			<ListHeader
				class="mb-2 grid items-center rounded-none border-b bg-surface-white p-2"
			>
				<ListHeaderItem :item="item" v-for="item in columns">
					<template #prefix="{ item }">
						<FeatherIcon :name="item.icon?.toString()" class="h-4 w-4" />
					</template>
				</ListHeaderItem>
			</ListHeader>
			<ListRows>
				<ListRow
					:row="row"
					v-for="row in exercises.data"
					class="hover:bg-surface-gray-1"
				>
					<template #default="{ column, item }">
						<ListRowItem :item="row[column.key]" :align="column.align">
							<div
								v-if="column.key == 'modified'"
								class="text-sm text-ink-gray-5"
							>
								{{ dayjs(row[column.key]).format('MMM D, YYYY') }}
							</div>
							<div v-else>
								{{ row[column.key] }}
							</div>
						</ListRowItem>
					</template>
				</ListRow>
			</ListRows>
			<ListSelectBanner>
				<template #actions="{ unselectAll, selections }">
					<div class="flex gap-2">
						<Button
							variant="ghost"
							@click="showDeleteConfirmation(selections, unselectAll)"
						>
							<FeatherIcon name="trash-2" class="h-4 w-4 stroke-1.5" />
						</Button>
					</div>
				</template>
			</ListSelectBanner>
		</ListView>
		<div v-else class="flex flex-1 items-center justify-center px-5">
			<EmptyStateLayout name="Programming Exercises" />
		</div>
		<ListFooter
			v-model="pageLength"
			class="border-t px-3 py-2 sm:px-5"
			:options="{
				rowCount: exercises.data?.length,
				totalCount: totalExercises.data,
			}"
		>
			<template #right>
				<div class="flex items-center">
					<Button
						v-if="exercises.hasNextPage"
						:label="__('Load More')"
						@click="exercises.next()"
					/>
					<div v-if="exercises.hasNextPage" class="mx-3 h-[80%] border-l" />
					<div class="flex items-center gap-1 text-base text-ink-gray-5">
						<div>{{ exercises.data?.length || 0 }}</div>
						<div>{{ __('of') }}</div>
						<div>{{ totalExercises.data || 0 }}</div>
					</div>
				</div>
			</template>
		</ListFooter>
	</div>
	<ProgrammingExerciseForm
		v-model="showForm"
		v-model:exercises="exercises"
		:exerciseID="exerciseID"
		v-model:totalExercises="totalExercises"
	/>
</template>
<script setup lang="ts">
import { computed, getCurrentInstance, inject, onMounted, ref } from 'vue'
import type dayjsType from 'dayjs'
import {
	Breadcrumbs,
	Button,
	call,
	createResource,
	createListResource,
	FeatherIcon,
	FormControl,
	ListView,
	ListHeader,
	ListHeaderItem,
	ListRows,
	ListRow,
	ListRowItem,
	ListFooter,
	ListSelectBanner,
	toast,
	usePageMeta,
} from 'frappe-ui'
import Select from '@/components/Controls/Select.vue'
import { ClipboardList, Plus } from 'lucide-vue-next'
import { sessionStore } from '@/stores/session'
import { useRouter } from 'vue-router'
import ProgrammingExerciseForm from '@/pages/ProgrammingExercises/ProgrammingExerciseForm.vue'
import LayoutHeader from '@/components/Layouts/LayoutHeader.vue'

const readOnlyMode = window.read_only_mode
const { brand } = sessionStore()
const showForm = ref<boolean>(false)
const exerciseID = ref<string>('new')
const user = inject<any>('$user')
const dayjs = inject<typeof dayjsType>('$dayjs')!
const titleFilter = ref<string>('')
const languageFilter = ref<string>('')
const router = useRouter()
const app = getCurrentInstance()
const { $dialog } = app?.appContext.config.globalProperties

onMounted(() => {
	validatePermissions()
})

const validatePermissions = () => {
	if (
		!user.data?.is_instructor &&
		!user.data?.is_moderator &&
		!user.data?.is_evaluator
	) {
		router.push({
			name: 'ProgrammingExerciseSubmissions',
		})
	}
}

const exercises = createListResource({
	doctype: 'LMS Programming Exercise',
	cache: ['programmingExercises'],
	fields: ['name', 'title', 'language', 'problem_statement', 'modified'],
	auto: true,
	orderBy: 'modified desc',
})

const updateList = () => {
	let filters = getFilters()
	exercises.update({
		filters: filters,
	})
	exercises.reload()
	totalExercises.update({
		filters: filters,
	})
	totalExercises.reload()
}

const getFilters = () => {
	let filters: any = {}
	if (titleFilter.value) {
		filters['title'] = ['like', `%${titleFilter.value}%`]
	}
	if (languageFilter.value && languageFilter.value.trim() !== '') {
		filters['language'] = languageFilter.value
	}
	return filters
}

const showDeleteConfirmation = (
	selections: Set<string>,
	unselectAll: () => void
) => {
	$dialog({
		title: __('Confirm Your Action'),
		message: __(
			'Deleting these exercises will permanently remove them from the system, along with all associated submissions. This action is irreversible. Are you sure you want to proceed?'
		),
		actions: [
			{
				label: __('Delete'),
				theme: 'red',
				variant: 'solid',
				onClick(close: () => void) {
					deleteExercises(selections, unselectAll)
					close()
				},
			},
		],
	})
}

const deleteExercises = (selections: Set<string>, unselectAll: () => void) => {
	Array.from(selections).forEach(async (exerciseName) => {
		call('lms.lms.api.delete_programming_exercise', {
			exercise: exerciseName,
		})
			.then(() => {
				toast.success(__('Exercise deleted successfully'))
				updateList()
			})
			.catch((error: any) => {
				toast.error(__(error.message || error))
				console.error('Error deleting exercise:', error)
			})
	})
	unselectAll()
}

const pageLength = computed({
	get: () => exercises.pageLength,
	set: (value) => {
		exercises.update({ pageLength: value })
		exercises.reload()
	},
})

const totalExercises = createResource({
	url: 'frappe.client.get_count',
	params: {
		doctype: 'LMS Programming Exercise',
		filters: getFilters(),
	},
	auto: true,
	cache: ['programming_exercises_count', user.data?.name],
	onError(err: any) {
		toast.error(err.messages?.[0] || err)
		console.error(err)
	},
})

const languages = [
	{ label: ' ', value: ' ' },
	{ label: 'Python', value: 'Python' },
	{ label: 'JavaScript', value: 'JavaScript' },
]

const columns = computed(() => {
	return [
		{
			label: __('Title'),
			key: 'title',
			width: 1,
			icon: 'file-text',
		},
		{
			label: __('Language'),
			key: 'language',
			width: 1,
			align: 'left',
			icon: 'code',
		},
		{
			label: __('Updated On'),
			key: 'modified',
			width: 1,
			icon: 'clock',
			align: 'right',
		},
	]
})

usePageMeta(() => {
	return {
		title: __('Programming Exercises'),
		icon: brand.favicon,
	}
})

const breadcrumbs = computed(() => {
	return [
		{
			label: __('Programming Exercises'),
			route: { name: 'ProgrammingExercises' },
		},
	]
})
</script>
