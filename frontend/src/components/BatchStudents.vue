<template>
	<div v-if="batch.data" class="">
		<div class="w-full flex items-center justify-between pb-4">
			<div class="font-medium text-ink-gray-7">
				{{ __('Statistics') }}
			</div>
		</div>
		<div class="grid grid-cols-4 gap-5 mb-8">
			<div
				class="flex items-center border py-2 px-3 rounded-md text-ink-gray-7"
			>
				<div class="p-2 rounded-md bg-surface-gray-2 mr-3">
					<User class="w-5 h-5 stroke-1.5" />
				</div>
				<div class="flex items-center space-x-2">
					<span class="font-semibold">
						{{ students.data?.length }}
					</span>
					<span class="">
						{{ __('Students') }}
					</span>
				</div>
			</div>

			<div
				class="flex items-center border py-2 px-3 rounded-md text-ink-gray-7"
			>
				<div class="p-2 rounded-md bg-surface-gray-2 mr-3">
					<GraduationCap class="w-5 h-5 stroke-1.5" />
				</div>
				<div class="flex items-center space-x-2">
					<span class="font-semibold">
						{{ certificationCount.data }}
					</span>
					<span class="">
						{{ __('Certified') }}
					</span>
				</div>
			</div>

			<div
				class="flex items-center border py-2 px-3 rounded-md text-ink-gray-7"
			>
				<div class="p-2 rounded-md bg-surface-gray-2 mr-3">
					<BookOpen class="w-5 h-5 stroke-1.5" />
				</div>
				<div class="flex items-center space-x-2">
					<span class="font-semibold">
						{{ batch.data.courses?.length }}
					</span>
					<span>
						{{ __('Courses') }}
					</span>
				</div>
			</div>

			<div
				class="flex items-center border py-2 px-3 rounded-md text-ink-gray-7"
			>
				<div class="p-2 rounded-md bg-surface-gray-2 mr-3">
					<ShieldCheck class="w-5 h-5 stroke-1.5" />
				</div>
				<div class="flex items-center space-x-2">
					<span class="font-semibold">
						{{ assessmentCount }}
					</span>
					<span>
						{{ __('Assessments') }}
					</span>
				</div>
			</div>
		</div>
		<div v-if="showProgressChart" class="mb-8">
			<div class="text-ink-gray-7 font-medium">
				{{ __('Progress') }}
			</div>
			<ApexChart
				:options="chartOptions"
				:series="chartData"
				type="bar"
				:height="chartData[0].data.length * 30 + 100"
			/>
			<div
				class="flex items-center justify-center text-sm text-ink-gray-7 space-x-4"
			>
				<div class="flex items-center space-x-2">
					<div
						class="w-3 h-3 rounded-sm"
						:style="{ 'background-color': theme.colors.green[600] }"
					></div>
					<div>
						{{ __('Courses') }}
					</div>
				</div>
				<div class="flex items-center space-x-2">
					<div
						class="w-3 h-3 rounded-sm"
						:style="{ 'background-color': theme.colors.blue[600] }"
					></div>
					<div>
						{{ __('Assessments') }}
					</div>
				</div>
			</div>
		</div>
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
const chartOptions = ref(null)
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
	let categories = {}

	if (!students.data?.length) return []

	Object.keys(students.data[0].courses).forEach((course) => {
		categories[course] = {
			value: 0,
			type: 'course',
			label: course,
		}
	})

	Object.keys(students.data?.[0].assessments).forEach((assessment) => {
		categories[assessment] = {
			value: 0,
			type: 'assessment',
			label: assessment,
		}
	})

	students.data.forEach((student) => {
		Object.keys(student.courses).forEach((course) => {
			if (student.courses[course] === 100) {
				categories[course].value += 1
			}
		})

		Object.keys(student.assessments).forEach((assessment) => {
			if (student.assessments[assessment].result === 'Pass') {
				categories[assessment].value += 1
			}
		})
	})

	chartOptions.value = getChartOptions(categories)
	return [
		{
			name: __('Completed by Students'),
			data: Object.values(categories).map((item) => item.value),
		},
	]
}

const getChartOptions = (categories) => {
	const courseColor = theme.colors.green[700]
	const assessmentColor = theme.colors.blue[700]
	const maxY =
		students.data?.length % 5
			? students.data?.length + (5 - (students.data?.length % 5))
			: students.data?.length

	return {
		chart: {
			type: 'bar',
			toolbar: {
				show: false,
			},
		},
		plotOptions: {
			bar: {
				distributed: true,
				borderRadius: 3,
				borderRadiusApplication: 'end',
				horizontal: true,
				barHeight: '40%',
			},
		},
		colors: Object.values(categories).map((item) =>
			item.type === 'course' ? courseColor : assessmentColor
		),
		xaxis: {
			categories: Object.values(categories).map((item) => item.label),
			labels: {
				style: {
					fontSize: '10px',
				},
				rotate: 0,
				formatter: function (value) {
					return value.length > 30 ? `${value.substring(0, 30)}...` : value
				},
			},
		},
		yaxis: {
			max: maxY,
			min: 0,
			stepSize: 10,
			tickAmount: maxY / 5,
			/* reversed: true */
		},
	}
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
<style>
.apexcharts-legend {
	display: none !important;
}
</style>
