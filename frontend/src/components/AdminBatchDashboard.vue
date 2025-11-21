<template>
	<div v-if="batch?.data" class="">
		<div class="w-full flex items-center justify-between pb-4">
			<div class="font-medium text-ink-gray-7">
				{{ __('Statistics') }}
			</div>
		</div>
		<div class="grid grid-cols-2 md:grid-cols-4 gap-5 mb-8">
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
					value: batch?.data?.courses?.length || 0,
				}"
			/>

			<NumberChart
				class="border rounded-md"
				:config="{ title: __('Assessments'), value: assessmentCount || 0 }"
			/>
		</div>

		<AxisChart
			v-if="showProgressChart"
			class="border"
			:config="{
				data: chartData || [],
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
</template>
<script setup lang="ts">
import { AxisChart, createResource, NumberChart } from 'frappe-ui'
import { ref, watch } from 'vue'

const chartData = ref<null | any[]>(null)
const showProgressChart = ref(false)
const assessmentCount = ref(0)

const props = defineProps<{
	batch: { [key: string]: any } | null
}>()

const students = createResource({
	url: 'lms.lms.utils.get_batch_students',
	params: {
		batch: props.batch?.data?.name,
	},
	auto: true,
	onSuccess(data: any[]) {
		chartData.value = getChartData()
		showProgressChart.value =
			data.length &&
			(props.batch?.data?.courses?.length || assessmentCount.value)
	},
})

const getChartData = () => {
	let tasks: any[] = []
	let data: { task: any; value: any }[] = []

	students.data.forEach((row: any) => {
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

const countAssessments = (
	row: { assessments: { [x: string]: { result: string } } },
	tasks: any[]
) => {
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

const countCourses = (
	row: { courses: { [x: string]: number } },
	tasks: any[]
) => {
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

watch(students, () => {
	if (students.data?.length) {
		assessmentCount.value = Object.keys(students.data?.[0].assessments).length
	}
})
</script>
