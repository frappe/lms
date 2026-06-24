<template>
	<div v-if="batch?.data" class="p-5">
		<div class="grid grid-cols-2 md:grid-cols-4 gap-5 mb-8">
			<NumberChartGraph
				:title="__('Enrolled')"
				:value="formatAmount(batch.data?.students?.length) || 0"
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
			class="flex min-h-[70vh] flex-col items-center justify-center gap-3 px-4 text-center"
		>
			<span class="lucide-users size-7.5 text-ink-gray-5" />
			<div class="flex flex-col items-center gap-1">
				<span class="text-xl-medium text-ink-gray-8">
					{{ __('No students enrolled yet') }}
				</span>
				<span class="text-p-base text-ink-gray-6">
					{{ __('Enroll students to track their progress here.') }}
				</span>
			</div>
		</div>
		<div
			v-else
			class="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-5 items-start"
		>
			<div class="border rounded-lg py-3 px-4 order-2 lg:order-1">
				<div class="flex items-center justify-between gap-x-2 mb-3">
					<div class="text-xl-semibold text-ink-gray-9">
						{{ __('Students') }}
					</div>
					<div class="flex items-center gap-x-2">
						<FormControl
							v-model="searchFilter"
							:placeholder="__('Search')"
							type="text"
						>
							<template #prefix>
								<span class="lucide-search size-4 text-ink-gray-5" />
							</template>
						</FormControl>
					</div>
				</div>
				<div class="max-h-[63vh] overflow-y-auto">
					<ListView
						v-if="students.loading || students.data?.length"
						:columns="studentColumns"
						:rows="students.data"
						rowKey="name"
						:options="{
							selectable: false,
							showTooltip: false,
							onRowClick: (row: any) => {
								currentStudent = row.member
								showProgressModal = true
							},
						}"
					>
						<ListHeader
							class="mb-2 grid items-center gap-x-4 rounded bg-surface-gray-2 p-2"
						>
							<ListHeaderItem
								:item="item"
								v-for="item in studentColumns"
								:key="item.key"
							>
							</ListHeaderItem>
						</ListHeader>
						<ListRows>
							<ListRow v-for="row in students.data" :key="row.name" :row="row">
								<template #default="{ column, item }">
									<ListRowItem
										:item="row[column.key]"
										:align="column.align"
										class="w-full"
									>
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
										<div v-if="column.key == 'creation'">
											{{ dayjs(row[column.key]).format('DD MMM YYYY') }}
										</div>
										<div
											v-else-if="column.key == 'progress'"
											class="text-xs !mx-0 w-5"
										>
											{{ Math.ceil(row[column.key]) }}%
										</div>
										<div v-else>
											{{ row[column.key].toString() }}
										</div>
									</ListRowItem>
								</template>
							</ListRow>
						</ListRows>
					</ListView>
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
									? __('Try a different name.')
									: __('Enroll students to track their progress here.')
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
	<StudentModal
		v-if="showEnrollmentModal"
		v-model="showEnrollmentModal"
		:batch="batch"
		:students="students"
	/>
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
	ListView,
	ListHeader,
	ListHeaderItem,
	ListRows,
	ListRow,
	ListRowItem,
	Avatar,
	Button,
} from 'frappe-ui'
import { computed, inject, ref, watch } from 'vue'
import type dayjsType from 'dayjs'
import { formatAmount } from '@/utils'
import BatchFeedback from '@/pages/Batches/components/BatchFeedback.vue'
import BatchStudentProgress from '@/pages/Batches/components/BatchStudentProgress.vue'
import NumberChartGraph from '@/components/NumberChartGraph.vue'
import StudentModal from '@/components/Modals/StudentModal.vue'
import EmptyStateLayout from '@/components/Layouts/EmptyStateLayout.vue'

const dayjs = inject<typeof dayjsType>('$dayjs')!
const searchFilter = ref<string | null>(null)
const showEnrollmentModal = ref<boolean>(false)
const showProgressModal = ref<boolean>(false)
const currentStudent = ref<any>(null)

function openEnrollModal() {
	showEnrollmentModal.value = true
}

defineExpose({ openEnrollModal })

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
})

const filteredChartData = computed(() =>
	(chartData.data || []).filter((item: { value: number }) => item.value > 0)
)

watch(searchFilter, () => {
	let filters: Record<string, any> = {
		batch: props.batch?.data?.name,
	}

	if (searchFilter.value) {
		filters.member_name = ['like', `%${searchFilter.value}%`]
	}

	students.update({ filters })
	students.reload()
})

const studentColumns = computed(() => {
	return [
		{
			label: __('Name'),
			key: 'member_name',
			width: '40%',
		},
		{
			label: __('Enrolled On'),
			key: 'creation',
			align: 'right',
		},
	]
})

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
