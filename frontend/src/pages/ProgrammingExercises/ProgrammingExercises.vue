<template>
	<ListPage
		:breadcrumbs="breadcrumbs"
		:title="__('{0} Exercises').format(totalExercises.data || 0)"
		layout="list"
		:columns="columns"
		:rows="exercises.data || []"
		:list-options="listOptions"
		:total-count="totalExercises.data ?? 0"
		:loading="exercises.list.loading"
		:has-next-page="exercises.hasNextPage"
		v-model:page-length="pageLength"
		empty-name="Programming Exercises"
		empty-icon="lucide-code"
		@load-more="exercises.next()"
	>
		<template #actions>
			<router-link
				v-if="exercises.data?.length"
				class="hidden md:block"
				:to="{
					name: 'ProgrammingExerciseSubmissions',
				}"
			>
				<Button>
					<template #prefix>
						<span class="lucide-clipboard-list size-4" />
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
					<span class="lucide-plus size-4" />
				</template>
				{{ __('Create') }}
			</Button>
		</template>

		<template #filters>
			<FormControl
				v-model="titleFilter"
				:placeholder="__('Search')"
				:aria-label="__('Search')"
				@input="updateList"
			>
				<template #prefix>
					<span class="lucide-search size-4 text-ink-gray-5" />
				</template>
			</FormControl>
			<Select
				v-model="languageFilter"
				:options="languages"
				:placeholder="__('Type')"
				@update:modelValue="updateList"
			/>
		</template>

		<template #cell="{ column, value }">
			<div v-if="column.key == 'modified'" class="text-sm text-ink-gray-5">
				<!-- A cell value is `unknown` — a row is a bag of fields and only
				     the branch it lands in knows what one holds. -->
				{{ dayjs(value as string).format('MMM D, YYYY') }}
			</div>
			<div v-else>{{ value }}</div>
		</template>

		<template #selection-actions="{ unselectAll, selections }">
			<Button
				variant="ghost"
				:label="__('Delete')"
				@click="showDeleteConfirmation(selections, unselectAll)"
			>
				<span class="lucide-trash-2 size-4" />
			</Button>
		</template>
	</ListPage>

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
	Button,
	call,
	createResource,
	createListResource,
	FormControl,
	toast,
	usePageMeta,
} from 'frappe-ui'
import ListPage from '@/components/Layouts/ListPage.vue'
import Select from '@/components/Controls/Select.vue'
import type { ListRow } from '@/types'

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
	pageLength: 24,
})

const listOptions = computed(() => ({
	showTooltip: false,
	selectable: true,
	onRowClick: (row: ListRow) => {
		if (readOnlyMode) return
		exerciseID.value = row.name as string
		showForm.value = true
	},
}))

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
		// reload() ignores a new pageLength while start > 0: it refetches the
		// already loaded rows instead, so paging must be reset for it to apply.
		exercises.update({ pageLength: value, start: 0 })
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
			icon: 'lucide-file-text',
		},
		{
			label: __('Language'),
			key: 'language',
			width: 1,
			align: 'left',
			icon: 'lucide-code',
		},
		{
			label: __('Updated On'),
			key: 'modified',
			width: 1,
			icon: 'lucide-clock',
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
