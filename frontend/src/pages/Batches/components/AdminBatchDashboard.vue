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
				class="border rounded-md"
				:title="__('Courses')"
				:value="batch?.data?.courses?.length || 0"
			/>

			<NumberChartGraph
				class="border rounded-md"
				:title="__('Assessments')"
				:value="batch?.data?.assessments?.length || 0"
			/>
		</div>

		<div class="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-5 items-start">
			<div class="border rounded-lg py-3 px-4 order-2 lg:order-1">
				<div class="flex items-center justify-between gap-x-2 mb-3">
					<div class="text-lg text-ink-gray-9 font-semibold">
						{{ __('Students') }}
					</div>
					<div class="flex items-center gap-x-2">
						<FormControl
							v-model="searchFilter"
							:placeholder="__('Search by name')"
							type="text"
						/>
						<Button @click="showEnrollmentModal = true">
							<template #prefix>
								<Plus class="size-4 stroke-1.5" />
							</template>
							{{ __('Enroll') }}
						</Button>
					</div>
				</div>
				<div
					v-if="students.loading || students.data?.length"
					class="max-h-[63vh] overflow-y-auto"
				>
					<ListView
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
							class="mb-2 grid items-center gap-x-4 rounded bg-surface-white border-b rounded-none p-2"
						>
							<ListHeaderItem
								:item="item"
								v-for="item in studentColumns"
								:key="item.key"
							>
							</ListHeaderItem>
						</ListHeader>
						<ListRows v-for="row in students.data" class="max-h-[500px]">
							<ListRow :row="row">
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
											<!-- <ProgressBar
												v-else-if="column.key == 'progress'"
												:progress="Math.ceil(row[column.key])"
												class="!mx-0 !me-4"
											/> -->
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
										<div
											v-else-if="column.key == 'remove'"
											class="flex justify-end"
										>
											<Button
												variant="ghost"
												:tooltip="__('Remove student from batch')"
												@click.stop="promptRemoveStudent(row)"
											>
												<template #icon>
													<Trash2 class="size-4 text-ink-red-3" />
												</template>
											</Button>
										</div>
										<div v-else>
											{{ row[column.key].toString() }}
										</div>
									</ListRowItem>
								</template>
							</ListRow>
						</ListRows>
					</ListView>
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

			<div class="order-1 lg:order-2">
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

				<div class="p-4 border rounded-lg mt-5">
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
	<Dialog
		v-model="showRemoveDialog"
		:options="{
			title: __('Remove Student'),
			message: __(
				'Remove {0} from this batch? This also revokes the course access the batch granted them.'
			).format(studentToRemove?.member_name || studentToRemove?.member || ''),
			size: 'sm',
			actions: [
				{
					label: __('Remove'),
					variant: 'solid',
					theme: 'red',
					onClick: confirmRemoveStudent,
				},
				{
					label: __('Cancel'),
					onClick: closeRemoveDialog,
				},
			],
		}"
	/>
</template>
<script setup lang="ts">
import {
	AxisChart,
	call,
	createResource,
	createListResource,
	Dialog,
	FormControl,
	ListView,
	ListHeader,
	ListHeaderItem,
	ListRows,
	ListRow,
	ListRowItem,
	Avatar,
	Button,
	toast,
} from 'frappe-ui'
import { computed, inject, ref, watch } from 'vue'
import type dayjsType from 'dayjs'
import { formatAmount } from '@/utils'
import { Plus, Trash2 } from 'lucide-vue-next'
import BatchFeedback from '@/pages/Batches/components/BatchFeedback.vue'
import BatchStudentProgress from '@/pages/Batches/components/BatchStudentProgress.vue'
import NumberChartGraph from '@/components/NumberChartGraph.vue'
import StudentModal from '@/components/Modals/StudentModal.vue'

const dayjs = inject<typeof dayjsType>('$dayjs')!
const searchFilter = ref<string | null>(null)
const showEnrollmentModal = ref<boolean>(false)
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
		{
			label: '',
			key: 'remove',
			align: 'right',
			width: '60px',
		},
	]
})

const showRemoveDialog = ref(false)
const studentToRemove = ref<any>(null)

function promptRemoveStudent(row: any) {
	studentToRemove.value = row
	showRemoveDialog.value = true
}

function closeRemoveDialog() {
	showRemoveDialog.value = false
}

function confirmRemoveStudent() {
	const row = studentToRemove.value
	if (!row) return
	return call('ecological_society.batch.remove_student_from_batch', {
		batch: props.batch?.data?.name,
		member: row.member,
	})
		.then(() => {
			toast.success(__('Student removed from batch'))
			showRemoveDialog.value = false
			students.reload()
		})
		.catch((e: any) => {
			toast.error(e?.messages?.[0] || __('Could not remove student'))
		})
}

const showProgressChart = computed(
	() =>
		students.data?.length &&
		(props.batch?.data?.courses?.length ||
			props.batch?.data?.assessments?.length)
)
</script>
