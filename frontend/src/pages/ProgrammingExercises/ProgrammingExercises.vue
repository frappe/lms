<template>
	<header
		class="sticky flex items-center justify-between top-0 z-10 border-b bg-surface-white px-3 py-2.5 sm:px-5"
	>
		<Breadcrumbs :items="breadcrumbs" />
		<div class="flex gap-2">
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
		</div>
	</header>
	<div class="py-5">
		<div
			class="flex flex-col md:flex-row md:items-center space-y-4 md:space-y-0 justify-between mb-5 px-5"
		>
			<div class="text-lg font-semibold text-ink-gray-9">
				{{ __('{0} Exercises').format(exercises.data?.length) }}
			</div>
			<div class="grid grid-cols-2 gap-5">
				<FormControl
					v-model="titleFilter"
					:placeholder="__('Search by Title')"
					@input="updateList"
				/>
				<FormControl
					v-model="languageFilter"
					type="select"
					:options="languages"
					:placeholder="__('Type')"
					@update:modelValue="updateList"
				/>
			</div>
		</div>

		<div v-if="exercises.data?.length">
			<ListView
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
				class="h-[71vh] lg:h-[79vh] px-5"
			>
				<ListHeader
					class="mb-2 grid items-center rounded bg-surface-white border-b rounded-none p-2"
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
		</div>
		<div v-else class="h-[45vh] lg:h-[53vh] px-5">
			<EmptyStateLayout name="Programming Exercises" />
		</div>
		<div class="flex items-center justify-end gap-x-3 px-5 pt-3 border-t">
			<Button v-if="exercises.hasNextPage" @click="exercises.next()">
				{{ __('Load More') }}
			</Button>
			<div v-if="exercises.hasNextPage" class="h-8 border-s"></div>
			<div class="text-ink-gray-5">
				{{ exercises.data?.length }} {{ __('of') }} {{ totalExercises.data }}
			</div>
		</div>
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
	ListSelectBanner,
	toast,
	usePageMeta,
} from 'frappe-ui'
import { ClipboardList, Plus } from 'lucide-vue-next'
import { sessionStore } from '@/stores/session'
import { useRouter } from 'vue-router'
import ProgrammingExerciseForm from '@/pages/ProgrammingExercises/ProgrammingExerciseForm.vue'

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
