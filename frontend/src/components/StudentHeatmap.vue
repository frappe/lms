<template>
	<ApexChart
		v-if="heatmap.data"
		:options="chartOptions"
		:series="chartSeries"
		height="350"
	/>
	{{ heatmap.data }}
</template>
<script setup>
import { createResource } from 'frappe-ui'
import { computed, inject } from 'vue'
import ApexChart from 'vue3-apexcharts'

const user = inject('$user')

const props = defineProps({
	batch: {
		type: String,
		required: true,
	},
})

const heatmap = createResource({
	url: 'lms.lms.api.get_heatmap_data',
	auto: true,
	cache: ['heatmap', user.data?.name],
})

const chartOptions = computed(() => {
	return {
		chart: {
			type: 'heatmap',
			height: 50,
			toolbar: {
				show: false,
			},
		},
		plotOptions: {
			heatmap: {
				shadeIntensity: 0.5,
				enableShades: true,
				colorScale: {
					ranges: [
						{ from: 0, to: 0, color: '#e3f2fd' }, // No activity
						{ from: 1, to: 5, color: '#81c784' }, // Low activity
						{ from: 6, to: 15, color: '#66bb6a' }, // Medium activity
						{ from: 16, to: 30, color: '#388e3c' }, // High activity
						{ from: 31, to: 100, color: '#1b5e20' }, // Very high activity
					],
				},
			},
		},
		dataLabels: {
			enabled: false,
		},
		xaxis: {
			type: 'category',
			labels: { rotate: -45 },
		},
		yaxis: {
			type: 'category',
			categories: [
				'Monday',
				'Tuesday',
				'Wednesday',
				'Thursday',
				'Friday',
				'Saturday',
				'Sunday',
			],
		},
		tooltip: {
			y: { formatter: (value) => `${value} activities` },
		},
		colors: ['#008FFB'],
	}
})

const chartSeries = computed(() => {
	let series = []
	heatmap.data?.forEach((week) => {
		series.push({
			name: week.name,
			data: week.data,
		})
	})
	return series
})
</script>
