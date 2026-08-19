<template>
	<div v-if="batch?.data" class="p-5">
		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
			<NumberChartGraph
				:title="__('Enrolled')"
				:value="formatAmount(studentCount.data) || 0"
			/>

			<NumberChartGraph
				:title="__('Certified')"
				:value="certificationCount.data || 0"
			/>

			<NumberChartGraph
				:title="__('Courses')"
				:value="batch?.data?.courses?.length || 0"
			/>

			<NumberChartGraph
				:title="__('Assessments')"
				:value="batch?.data?.assessments?.length || 0"
			/>
		</div>

		<div
			v-if="showStudentsEmptyState"
			class="flex min-h-[30vh] sm:min-h-[70vh] flex-col items-center justify-center gap-3 px-4 text-center"
		>
			<span class="lucide-users size-7.5 text-ink-gray-5" />
			<div class="flex flex-col items-center gap-1">
				<span class="text-lg-medium text-ink-gray-8">
					{{ __('No students enrolled yet') }}
				</span>
				<span class="text-p-base text-ink-gray-6">
					{{ __('Enroll students to track their progress here') }}
				</span>
			</div>
		</div>
		<div
			v-else
			class="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-5 items-start"
		>
			<div class="border rounded-lg py-3 px-4 order-2 lg:order-1">
				<div class="flex items-center justify-between gap-x-2 mb-3">
					<h2 class="text-lg-semibold text-ink-gray-9">
						{{ __('Students') }}
					</h2>
					<div class="flex items-center gap-x-2">
						<FormControl
							v-model="searchFilter"
							:placeholder="__('Search')"
							:aria-label="__('Search')"
							type="text"
						>
							<template #prefix>
								<span class="lucide-search size-4 text-ink-gray-5" />
							</template>
						</FormControl>
					</div>
				</div>
				<div class="sm:max-h-[63vh] sm:overflow-y-auto">
					<ResponsiveListView
						v-if="students.loading || students.data?.length"
						:columns="studentColumns"
						:rows="students.data || []"
						row-key="name"
						:options="studentListOptions"
					>
						<template #cell="{ column, row, value }">
							<span
								v-if="column.key === 'member_name'"
								class="flex items-center gap-2"
							>
								<Avatar
									:image="row.member_image as string"
									:label="String(value)"
									size="sm"
								/>
								<span class="min-w-0 truncate">{{ value }}</span>
							</span>
							<span v-else-if="column.key === 'creation'">
								{{ dayjs(value as string).format('DD MMM YYYY') }}
							</span>
							<span v-else>{{ value }}</span>
						</template>
					</ResponsiveListView>
					<div v-else class="min-h-[200px]">
						<EmptyStateLayout
							name="Students"
							icon="lucide-users"
							:title="
								searchFilter
									? __('No students match your search')
									: __('No students enrolled yet')
							"
							:description="
								searchFilter
									? __('Try a different name')
									: __('Enroll students to track their progress here')
							"
						/>
					</div>
					<div
						v-if="students.data && students.hasNextPage"
						class="flex justify-center my-3"
					>
						<Button @click="students.next()">
							{{ __('Load More') }}
						</Button>
					</div>
				</div>
			</div>

			<div class="order-1 lg:order-2 space-y-5">
				<AxisChart
					v-if="showProgressChart"
					class="border rounded-lg p-3 min-h-[300px]"
					:config="{
						data: filteredChartData,
						title: __('Batch Summary'),
						subtitle: __('Progress of students in courses and assessments'),
						xAxis: {
							key: 'task',
							title: 'Tasks',
							type: 'category',
						},
						yAxis: {
							title: __('Number of Students'),
							echartOptions: {
								minInterval: 1,
							},
						},
						series: [
							{
								name: 'value',
								type: 'bar',
							},
						],
					}"
				/>

				<div class="p-4 border rounded-lg">
					<BatchFeedback v-if="batch.data" :batch="batch.data.name" />
				</div>
			</div>
		</div>
	</div>
	<BatchStudentProgress
		v-if="showProgressModal"
		v-model="showProgressModal"
		:student="currentStudent"
		:batch="batch?.data?.name"
	/>
</template>
<script setup lang="ts">
import {
	AxisChart,
	createResource,
	createListResource,
	FormControl,
	Avatar,
	Button,
} from 'frappe-ui'
import { computed, inject, onMounted, ref, watch } from 'vue'
import type dayjsType from 'dayjs'
import { formatAmount } from '@/utils'
import BatchFeedback from '@/pages/Batches/components/BatchFeedback.vue'
import BatchStudentProgress from '@/pages/Batches/components/BatchStudentProgress.vue'
import NumberChartGraph from '@/components/NumberChartGraph.vue'
import ResponsiveListView from '@/components/ResponsiveListView.vue'
import EmptyStateLayout from '@/components/Layouts/EmptyStateLayout.vue'
import type { ListColumn, ListRow, ListViewOptions } from '@/types'

const dayjs = inject<typeof dayjsType>('$dayjs')!
const searchFilter = ref<string | null>(null)
const showProgressModal = ref<boolean>(false)
const currentStudent = ref<any>(null)

const props = defineProps<{
	batch: { [key: string]: any } | null
}>()

const chartData = createResource({
	url: 'lms.lms.utils.get_batch_chart_data',
	cache: ['batch_chart_data', props.batch?.data?.name],
	params: { batch: props.batch?.data?.name },
	auto: true,
})

const certificationCount = createResource({
	url: 'frappe.client.get_count',
	cache: ['batch_certificate_count', props.batch?.data?.name],
	params: {
		doctype: 'LMS Certificate',
		filters: { batch_name: props.batch?.data?.name },
	},
	auto: true,
})

// The Enrolled card used to read batch.data.students.length, refreshed by the
// enrollment modal calling batch.reload() on the resource it was handed. The
// routed form has no such handle — get_batch_details deliberately carries no
// cache key (useBatchForms.ts) — so the count comes from its own cached
// resource, shaped like certificationCount above, which the form can reach by
// key. The two numbers are identical: get_batch_details builds `students` from
// exactly this get_all with no further filter.
const studentCount = createResource({
	url: 'frappe.client.get_count',
	cache: ['batch_student_count', props.batch?.data?.name],
	params: {
		doctype: 'LMS Batch Enrollment',
		filters: { batch: props.batch?.data?.name },
	},
	auto: true,
})

const students = createListResource({
	doctype: 'LMS Batch Enrollment',
	filters: {
		batch: props.batch?.data?.name,
	},
	fields: [
		'name',
		'member',
		'member_name',
		'member_username',
		'member_image',
		'creation',
	],
	orderBy: 'creation desc',
	auto: true,
	// Named so BatchStudentForm can reload it through getCachedListResource
	// after inserting. Keyed by batch, because BatchDetail is per-batch.
	cache: ['batchStudents', props.batch?.data?.name],
})

const filteredChartData = computed(() =>
	(chartData.data || []).filter((item: { value: number }) => item.value > 0)
)

const studentFilters = (): Record<string, any> => {
	const filters: Record<string, any> = {
		batch: props.batch?.data?.name,
	}

	if (searchFilter.value) {
		filters.member_name = ['like', `%${searchFilter.value}%`]
	}

	return filters
}

watch(searchFilter, () => {
	students.update({ filters: studentFilters() })
	students.reload()
})

// The cache key deliberately outlives this component so the student form can
// reload the list after inserting — but the filters ride along with it, while
// `searchFilter` is a component-local ref that starts empty on every mount. A
// remount would otherwise show the previous visit's search results underneath
// a blank search box. Only re-syncs when they actually disagree, so a first
// mount does not fetch twice.
onMounted(() => {
	const desired = studentFilters()

	if (JSON.stringify(students.filters) !== JSON.stringify(desired)) {
		students.update({ filters: desired })
		students.reload()
	}
})

const studentColumns = computed<ListColumn[]>(() => {
	return [
		{
			label: __('Name'),
			key: 'member_name',
			width: '40%',
		},
		{
			label: __('Enrolled On'),
			key: 'creation',
			align: 'left',
		},
	]
})

const studentListOptions: ListViewOptions = {
	selectable: false,
	showTooltip: false,
	onRowClick: (row: ListRow) => {
		currentStudent.value = row.member
		showProgressModal.value = true
	},
}

const showProgressChart = computed(
	() =>
		students.data?.length &&
		(props.batch?.data?.courses?.length ||
			props.batch?.data?.assessments?.length)
)

const showStudentsEmptyState = computed(
	() => !students.loading && !students.data?.length && !searchFilter.value
)
</script>
