<template>
	<div v-if="batch.data" class="">
		<div class="w-full flex items-center justify-between pb-4">
			<div class="font-medium text-ink-gray-7">
				{{ __('Statistics') }}
			</div>
		</div>
		<div class="grid grid-cols-4 gap-5 mb-8">
			<NumberChart
				class="border rounded-md"
				:config="{ title: __('Students'), value: students.data?.length || 0 }"
			/>

			<NumberChart
				class="border rounded-md"
				:config="{
					title: __('Certified'),
					value: certificationCount.data || 0,
				}"
			/>

			<NumberChart
				class="border rounded-md"
				:config="{
					title: __('Courses'),
					value: batch.data.courses?.length || 0,
				}"
			/>

			<NumberChart
				class="border rounded-md"
				:config="{ title: __('Assessments'), value: assessmentCount || 0 }"
			/>
		</div>

		<AxisChart
			v-if="showProgressChart"
			:config="{
				data: chartData,
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
				swapXY: true,
				series: [
					{
						name: 'value',
						type: 'bar',
					},
				],
			}"
		/>
	</div>

	<div>
		<div class="flex items-center justify-between mb-4">
			<div class="text-ink-gray-7 font-medium">
				{{ __('Students') }}
			</div>
			<Button v-if="!readOnlyMode" @click="openStudentModal()">
				<template #prefix>
					<Plus class="h-4 w-4" />
				</template>
				{{ __('Add') }}
			</Button>
		</div>

		<div v-if="students.data?.length">
			<ListView
				:columns="getStudentColumns()"
				:rows="students.data"
				row-key="name"
				:options="{
					showTooltip: false,
				}"
			>
				<ListHeader
					class="mb-2 grid items-center space-x-4 rounded bg-surface-gray-2 p-2"
				>
					<ListHeaderItem
						:item="item"
						v-for="item in getStudentColumns()"
						:title="item.label"
					>
						<template #prefix="{ item }">
							<FeatherIcon
								v-if="item.icon"
								:name="item.icon"
								class="h-4 w-4 stroke-1.5"
							/>
						</template>
					</ListHeaderItem>
				</ListHeader>
				<ListRows>
					<ListRow
						:row="row"
						v-for="row in students.data"
						class="group cursor-pointer"
						@click="openStudentProgressModal(row)"
					>
						<template #default="{ column, item }">
							<ListRowItem
								:item="row[column.key]"
								:align="column.align"
								class="text-sm"
							>
								<template #prefix>
									<div v-if="column.key == 'full_name'">
										<Avatar
											class="flex items-center"
											:image="row['user_image']"
											:label="item"
											size="sm"
										/>
									</div>
								</template>
								<div
									v-if="column.key == 'progress'"
									class="flex items-center space-x-4 w-full"
								>
									<ProgressBar :progress="row[column.key]" size="sm" />
									<div class="text-xs">{{ row[column.key] }}%</div>
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
								@click="removeStudents(selections, unselectAll)"
							>
								<Trash2 class="h-4 w-4 stroke-1.5" />
							</Button>
						</div>
					</template>
				</ListSelectBanner>
			</ListView>
		</div>
		<div v-else class="text-sm italic text-ink-gray-5">
			{{ __('There are no students in this batch.') }}
		</div>
	</div>

	<StudentModal
		:batch="props.batch.data.name"
		v-model="showStudentModal"
		v-model:reloadStudents="students"
		v-model:batchModal="props.batch"
	/>
	<BatchStudentProgress
		:student="selectedStudent"
		v-model="showStudentProgressModal"
	/>
</template>
<script setup>
import {
	Avatar,
	AxisChart,
	Button,
	createResource,
	FeatherIcon,
	ListHeader,
	ListHeaderItem,
	ListSelectBanner,
	ListRow,
	ListRows,
	ListView,
	ListRowItem,
	NumberChart,
	toast,
} from 'frappe-ui'
import {
	BookOpen,
	GraduationCap,
	Plus,
	ShieldCheck,
	Trash2,
	User,
} from 'lucide-vue-next'
import { ref, watch } from 'vue'
import StudentModal from '@/components/Modals/StudentModal.vue'
import ProgressBar from '@/components/ProgressBar.vue'
import BatchStudentProgress from '@/components/Modals/BatchStudentProgress.vue'
import ApexChart from 'vue3-apexcharts'
import { theme } from '@/utils/theme'

const showStudentModal = ref(false)
const showStudentProgressModal = ref(false)
const selectedStudent = ref(null)
const chartData = ref(null)
const showProgressChart = ref(false)
const assessmentCount = ref(0)
const readOnlyMode = window.read_only_mode

const props = defineProps({
	batch: {
		type: Object,
		default: null,
	},
})

const students = createResource({
	url: 'lms.lms.utils.get_batch_students',
	params: {
		batch: props.batch?.data?.name,
	},
	auto: true,
	onSuccess(data) {
		chartData.value = getChartData()
		showProgressChart.value =
			data.length &&
			(props.batch?.data?.courses?.length || assessmentCount.value)
	},
})

const getStudentColumns = () => {
	let columns = [
		{
			label: 'Full Name',
			key: 'full_name',
			width: '20rem',
			icon: 'user',
		},
		{
			label: 'Progress',
			key: 'progress',
			width: '15rem',
			icon: 'activity',
		},
		{
			label: 'Last Active',
			key: 'last_active',
			width: '10rem',
			align: 'center',
			icon: 'clock',
		},
	]

	return columns
}

const openStudentModal = () => {
	showStudentModal.value = true
}

const openStudentProgressModal = (row) => {
	showStudentProgressModal.value = true
	selectedStudent.value = row
}

const deleteStudents = createResource({
	url: 'lms.lms.api.delete_documents',
	makeParams(values) {
		return {
			doctype: 'LMS Batch Enrollment',
			documents: values.students,
		}
	},
})

const removeStudents = (selections, unselectAll) => {
	deleteStudents.submit(
		{
			students: Array.from(selections),
		},
		{
			onSuccess(data) {
				students.reload()
				props.batch.reload()
				toast.success(__('Students deleted successfully'))
				unselectAll()
			},
		}
	)
}

const getChartData = () => {
	let tasks = []
	let data = []

	students.data.forEach((row) => {
		tasks = countAssessments(row, tasks)
		tasks = countCourses(row, tasks)
	})

	tasks.forEach((task) => {
		data.push({
			task: task.label,
			value: task.value,
		})
	})
	return data
}

const countAssessments = (row, tasks) => {
	Object.keys(row.assessments).forEach((assessment) => {
		if (row.assessments[assessment].result === 'Pass') {
			tasks.filter((task) => task.label === assessment).length
				? tasks.filter((task) => task.label === assessment)[0].value++
				: tasks.push({
						value: 1,
						label: assessment,
				  })
		}
	})
	return tasks
}

const countCourses = (row, tasks) => {
	Object.keys(row.courses).forEach((course) => {
		if (row.courses[course] === 100) {
			tasks.filter((task) => task.label === course).length
				? tasks.filter((task) => task.label === course)[0].value++
				: tasks.push({
						value: 1,
						label: course,
				  })
		}
	})
	return tasks
}

watch(students, () => {
	if (students.data?.length) {
		assessmentCount.value = Object.keys(students.data?.[0].assessments).length
	}
})

const certificationCount = createResource({
	url: 'frappe.client.get_count',
	params: {
		doctype: 'LMS Certificate',
		filters: {
			batch_name: props.batch?.data?.name,
		},
	},
	auto: true,
})
</script>
