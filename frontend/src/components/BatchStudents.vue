<template>
	<div>
		<!-- <Bar v-if="chartData" :data="chartData" :options="chartOptions" /> -->
		<ApexChart
			v-if="chartData"
			:options="chartOptions"
			:series="chartData"
			type="bar"
			height="350"
		/>
		<div class="flex items-center justify-between mb-4">
			<div class="text-lg font-semibold">
				{{ __('Students') }}
			</div>
			<Button @click="openStudentModal()">
				<template #prefix>
					<Plus class="h-4 w-4" />
				</template>
				{{ __('Add') }}
			</Button>
		</div>
	</div>
	<div v-if="students.data?.length">
		<ListView
			:columns="getStudentColumns()"
			:rows="students.data"
			row-key="name"
			:options="{
				showTooltip: false,
				onRowClick: (row) => {
					openStudentProgressModal(row)
				},
			}"
		>
			<ListHeader
				class="mb-2 grid items-center space-x-4 rounded bg-gray-100 p-2"
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
				<ListRow :row="row" v-for="row in students.data">
					<template #default="{ column, item }">
						<ListRowItem :item="row[column.key]" :align="column.align">
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
							</div>
							<div v-else>
								{{ row[column.key] }}
							</div>
							<!-- <div v-else-if="column.icon == 'book-open'">
								{{ Math.ceil(row.courses[column.key]) }}
							</div>
							<div v-else-if="column.icon == 'help-circle'">
								<Badge
									v-if="isAssignment(row.assessments[column.key])"
									:theme="getStatusTheme(row.assessments[column.key])"
									class="text-xs"
								>
									{{ row.assessments[column.key] }}
								</Badge>
								<div v-else>{{ parseInt(row.assessments[column.key]) }}</div>
							</div> -->
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
	<div v-else class="text-sm italic text-gray-600">
		{{ __('There are no students in this batch.') }}
	</div>
	<StudentModal
		:batch="props.batch"
		v-model="showStudentModal"
		v-model:reloadStudents="students"
	/>
	<BatchStudentProgress
		:student="selectedStudent"
		v-model="showStudentProgressModal"
	/>
</template>
<script setup>
import {
	Avatar,
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
} from 'frappe-ui'
import { Trash2, Plus } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import StudentModal from '@/components/Modals/StudentModal.vue'
import { showToast } from '@/utils'
import ProgressBar from '@/components/ProgressBar.vue'
import BatchStudentProgress from '@/components/Modals/BatchStudentProgress.vue'
import { Bar } from 'vue-chartjs'
import {
	Chart as ChartJS,
	Title,
	Tooltip,
	Legend,
	BarElement,
	CategoryScale,
	LinearScale,
	Filler,
} from 'chart.js'
ChartJS.register(
	Title,
	Tooltip,
	Legend,
	BarElement,
	CategoryScale,
	LinearScale,
	Filler
)
import ApexChart from 'vue3-apexcharts'

const showStudentModal = ref(false)
const showStudentProgressModal = ref(false)
const selectedStudent = ref(null)
const chartData = ref(null)
const chartOptions = ref(null)

const props = defineProps({
	batch: {
		type: String,
		default: null,
	},
})

const students = createResource({
	url: 'lms.lms.utils.get_batch_students',
	cache: ['students', props.batch],
	params: {
		batch: props.batch,
	},
	auto: true,
	onSuccess(data) {
		chartData.value = getChartData()
		console.log(chartData.value)
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
			width: '10rem',
			icon: 'activity',
		},
		{
			label: 'Last Active',
			key: 'last_active',
			width: '15rem',
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
			doctype: 'Batch Student',
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
				showToast(__('Success'), __('Students deleted successfully'), 'check')
				unselectAll()
			},
		}
	)
}

const getChartData = () => {
	console.log('called')

	let categories = {}

	// Initialize categories with categories
	Object.keys(students.data?.[0].courses).forEach((course) => {
		categories[course] = {
			value: 0,
			type: 'course',
		}
	})

	Object.keys(students.data?.[0].assessments).forEach((assessment) => {
		categories[assessment] = {
			value: 0,
			type: 'assessment',
		}
	})

	// Populate data
	students.data.forEach((student) => {
		Object.keys(student.courses).forEach((course) => {
			if (student.courses[course] === 100) {
				categories[course].value += 1
			}
		})

		Object.keys(student.assessments).forEach((assessment) => {
			if (student.assessments[assessment] === 100) {
				categories[assessment].value += 1
			}
		})
	})

	// Transform data for ApexCharts
	console.log(Object.values(categories).map((item) => item.value))
	chartOptions.value = getChartOptions(categories)
	return [
		{
			name: __('Student Progress'),
			data: Object.values(categories).map((item) => item.value),
			/* colors: Object.values(categories).map(item =>
          item.type === 'course' ? courseColor : assessmentColor
        ), */
		},
	]
}

/* const chartOptions = computed(() => {
	return {
		responsive: true,
		fill: true,
		scales: {
			x: {
				ticks: {
					maxRotation: 0,
					minRotation: 0,
					autoSkip: false,
				}
			},
			y: {
				beginAtZero: true,
				max: students.data?.length,
				ticks: {
					stepSize: 5,
				},
			},
		},
		plugins: {
			legends: {
				display: false,
				title: {
					text: __("Student Progress 1111"),
				}
			},
			title: {
				display: true,
				text: __("Student Progress"),
				font: {
					size: 14,
					weight: '500',
				},
				color: '#171717',
			}
		}
	}
}) */

const chartSeries = ref([
	{
		name: 'Courses',
		data: [20, 30, 50], // Example data for courses
	},
	{
		name: 'Assessments',
		data: [10, 40, 60], // Example data for assessments
	},
])

const getChartOptions = (categories) => {
	const courseColor = '#3498db' // Blue for courses
	const assessmentColor = '#e74c3c' // Red for assessments
	return {
		chart: {
			type: 'bar',
			height: 350,
		},
		plotOptions: {
			bar: {
				distributed: true, // Allows individual bar colors
				borderRadius: 0,
				horizontal: false, // Set to true for horizontal bars
				columnWidth: '30%',
			},
		},
		colors: Object.values(categories).map((item) =>
			item.type === 'course' ? courseColor : assessmentColor
		),
		legends: {
			show: true,
		},
		xaxis: {
			categories: Object.keys(categories),
			labels: {
				style: {
					fontSize: '10px',
				},
				rotate: 0,
				formatter: function (value) {
					console.log(value)
					return value.length > 20 ? `${value.substring(0, 20)}...` : value // Trim long labels
				},
			},
		},
	}
}
</script>
