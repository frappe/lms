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
				:config="{ title: __('Students'), value: studentCount.data || 0 }"
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
				:config="{ title: __('Assessments'), value: assessmentCount.data || 0 }"
			/>
		</div>

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
import { computed } from 'vue'

const props = defineProps<{
	batch: { [key: string]: any } | null
}>()

const studentCount = createResource({
	url: 'frappe.client.get_count',
	cache: ['batch_student_count', props.batch?.data?.name],
	params: {
		doctype: 'LMS Batch Enrollment',
		filters: { batch: props.batch?.data?.name },
	},
	auto: true,
})

const assessmentCount = createResource({
	url: 'lms.lms.utils.get_batch_assessment_count',
	cache: ['batch_assessment_count', props.batch?.data?.name],
	params: {
		batch: props.batch?.data?.name,
	},
	auto: true,
})

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

const filteredChartData = computed(() =>
	(chartData.data || []).filter((item: { value: number }) => item.value > 0)
)

const showProgressChart = computed(
	() =>
		studentCount.data &&
		(props.batch?.data?.courses?.length || assessmentCount.data)
)
</script>
