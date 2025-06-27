<template>
	<header
		class="sticky flex items-center justify-between top-0 z-10 border-b bg-surface-white px-3 py-2.5 sm:px-5"
	>
		<Breadcrumbs :items="breadcrumbs" />
	</header>
	<div class="p-6">
		<div class="flex items-center justify-between space-x-32 mb-5">
			<div class="text-xl font-semibold text-ink-gray-7">
				{{
					submissions.data?.length
						? __('{0} Submissions').format(submissions.data.length)
						: __('No Submissions')
				}}
			</div>
			<div
				v-if="submissions.data?.length"
				class="grid grid-cols-3 gap-5 flex-1"
			>
				<Link
					doctype="LMS Programming Exercise"
					v-model="filters.exercise"
					:placeholder="__('Filter by Exercise')"
				/>
				<Link
					doctype="User"
					v-model="filters.member"
					:placeholder="__('Filter by Member')"
					:readonly="isStudent"
				/>
				<FormControl
					v-model="filters.status"
					type="select"
					:options="[
						{ label: __(''), value: '' },
						{ label: __('Passed'), value: 'Passed' },
						{ label: __('Failed'), value: 'Failed' },
					]"
					:placeholder="__('Filter by Status')"
				/>
			</div>
		</div>
		<ListView
			v-if="submissions.loading || submissions.data?.length"
			:columns="submissionColumns"
			:rows="submissions.data"
			rowKey="name"
			:options="{
				selectable: true,
			}"
		>
			<ListHeader
				class="mb-2 grid items-center space-x-4 rounded bg-surface-gray-2 p-2"
			>
				<ListHeaderItem
					:item="item"
					v-for="item in submissionColumns"
					:key="item.key"
				>
					<template #prefix="{ item }">
						<FeatherIcon :name="item.icon?.toString()" class="h-4 w-4" />
					</template>
				</ListHeaderItem>
			</ListHeader>
			<ListRows>
				<router-link
					v-for="row in submissions.data"
					:to="{
						name: 'ProgrammingExerciseSubmission',
						params: {
							exerciseID: row.exercise,
							submissionID: row.name,
						},
					}"
				>
					<ListRow :row="row">
						<template #default="{ column, item }">
							<ListRowItem :item="row[column.key]" :align="column.align">
								<template #prefix>
									<div v-if="column.key == 'member_name'">
										<Avatar
											class="flex items-center"
											:image="row['member_image']"
											:label="item"
											size="sm"
										/>
									</div>
								</template>
								<div v-if="column.key == 'status'">
									<Badge
										:theme="row[column.key] === 'Passed' ? 'green' : 'red'"
									>
										{{ row[column.key] }}
									</Badge>
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
				</router-link>
			</ListRows>
			<ListSelectBanner>
				<template #actions="{ unselectAll, selections }">
					<div class="flex gap-2">
						<Button
							variant="ghost"
							@click="deleteExercises(selections, unselectAll)"
						>
							<Trash2 class="h-4 w-4 stroke-1.5" />
						</Button>
					</div>
				</template>
			</ListSelectBanner>
		</ListView>
		<EmptyState v-else type="Programming Exercise Submissions" />
		<div
			v-if="submissions.data && submissions.hasNextPage"
			class="flex justify-center my-5"
		>
			<Button @click="submissions.next()">
				{{ __('Load More') }}
			</Button>
		</div>
	</div>
</template>
<script setup lang="ts">
import {
	Avatar,
	Badge,
	Breadcrumbs,
	Button,
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
	usePageMeta,
	toast,
} from 'frappe-ui'
import type {
	ProgrammingExerciseSubmission,
	Filters,
} from '@/pages/ProgrammingExercises/types'
import { computed, inject, onMounted, ref, watch } from 'vue'
import { sessionStore } from '@/stores/session'
import { useRouter } from 'vue-router'
import { Trash2 } from 'lucide-vue-next'
import Link from '@/components/Controls/Link.vue'
import EmptyState from '@/components/EmptyState.vue'

const { brand } = sessionStore()
const dayjs = inject('$dayjs') as any
const user = inject('$user') as any
const filterFields = ['exercise', 'member', 'status']
const filters = ref<Filters>({
	exercise: '',
	member: '',
	status: '',
})
const router = useRouter()

onMounted(() => {
	setFiltersFromRoute()
	fetchBasedOnRole()
})

const setFiltersFromRoute = () => {
	filterFields.forEach((field) => {
		if (router.currentRoute.value.query[field]) {
			filters.value[field as keyof Filters] = router.currentRoute.value.query[
				field
			] as string
		}
	})
}

const fetchBasedOnRole = () => {
	if (isStudent.value) {
		filters.value['member'] = user.data?.name
	} else {
		submissions.reload()
	}
}

const submissions = createListResource({
	doctype: 'LMS Programming Exercise Submission',
	fields: [
		'name',
		'exercise',
		'exercise_title',
		'member_name',
		'member_image',
		'status',
		'modified',
	],
	orderBy: 'modified desc',
	transform(data: ProgrammingExercise[]) {
		return data.map((submission: ProgrammingExerciseSubmission) => {
			return {
				...submission,
				modified: dayjs(submission.modified).fromNow(),
			}
		})
	},
})

watch(filters.value, () => {
	let filtersToApply: Record<string, any> = {}
	filterFields.forEach((field) => {
		if (filters.value[field as keyof Filters]) {
			filtersToApply[field] = filters.value[field as keyof Filters]
			router.push({
				query: {
					...router.currentRoute.value.query,
					[field]: filters.value[field as keyof Filters],
				},
			})
		} else {
			delete filtersToApply[field]
			const query = { ...router.currentRoute.value.query }
			delete query[field]
			router.push({
				query,
			})
		}
	})

	submissions.update({
		filters: {
			...filtersToApply,
		},
	})
	submissions.reload()
})

const deleteExercises = (selections: Set<string>, unselectAll: () => void) => {
	Array.from(selections).forEach(async (submission: string) => {
		await submissions.delete.submit(submission)
	})
	unselectAll()
	toast.success(__('Submissions deleted successfully'))
}

const isStudent = computed(() => {
	return (
		!user.data?.is_instructor &&
		!user.data?.is_moderator &&
		!user.data?.is_evaluator
	)
})

const submissionColumns = computed(() => {
	return [
		{
			label: __('Member'),
			key: 'member_name',
			width: '30%',
			icon: 'user',
		},
		{
			label: __('Exercise'),
			key: 'exercise_title',
			width: '30%',
			icon: 'code',
		},
		{
			label: __('Status'),
			key: 'status',
			width: '20%',
			icon: 'check-circle',
		},
		{
			label: __('Modified'),
			key: 'modified',
			width: '15%',
			icon: 'clock',
			align: 'right',
		},
	]
})

const breadcrumbs = computed(() => {
	return [
		{
			label: __('Programming Exercise Submissions'),
			route: {
				name: 'ProgrammingExerciseSubmissions',
			},
		},
	]
})

usePageMeta(() => {
	return {
		title: __('Programming Exercises'),
		icon: brand.favicon,
	}
})
</script>
