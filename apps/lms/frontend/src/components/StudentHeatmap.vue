<template>
	<div v-if="heatmap.data">
		<div class="text-lg font-semibold mb-2">
			{{ heatmap.data.total_activities }}
			{{
				heatmap.data.total_activities > 1 ? __('activities') : __('activity')
			}}
			{{ __('in the last') }}
			{{ heatmap.data.weeks }}
			{{ __('weeks') }}
		</div>

		<ApexChart :options="chartOptions" :series="chartSeries" height="240" />
	</div>
</template>
<script setup>
import { createResource } from 'frappe-ui'
import { computed, inject, onMounted, ref, watch } from 'vue'
import ApexChart from 'vue3-apexcharts'
import { theme } from '@/utils/theme'

const user = inject('$user')
const labels = ref([])
const memberName = ref(null)

const props = defineProps({
	member: {
		type: String,
	},
	days: {
		type: Number,
		default: 200,
	},
})

onMounted(() => {
	memberName.value = props.member || user.data?.name
})

const heatmap = createResource({
	url: 'lms.lms.api.get_heatmap_data',
	makeParams(values) {
		return {
			member: values.member,
			base_days: props.days,
		}
	},
	auto: false,
	cache: ['heatmap', memberName.value],
})

watch(memberName, (newVal) => {
	heatmap.reload(
		{
			member: newVal,
		},
		{
			onSuccess(data) {
				labels.value = data.labels
			},
		}
	)
})

const chartOptions = computed(() => {
	return {
		chart: {
			type: 'heatmap',
			toolbar: {
				show: false,
			},
		},
		highlightOnHover: false,
		grid: {
			show: false,
		},
		plotOptions: {
			heatmap: {
				radius: 8,
				shadeIntensity: 0.2,
				enableShades: true,
				colorScale: {
					ranges: [
						{ from: 0, to: 0, color: theme.colors.gray[400] },
						{ from: 1, to: 5, color: theme.colors.green[200] },
						{ from: 6, to: 15, color: theme.colors.green[500] },
						{ from: 16, to: 30, color: theme.colors.green[700] },
						{ from: 31, to: 100, color: theme.colors.green[800] },
					],
				},
			},
		},
		dataLabels: {
			enabled: false,
		},
		xaxis: {
			type: 'category',
			categories: labels.value,
			position: 'top',
			axisBorder: {
				show: false,
			},
			axisTicks: {
				show: false,
			},
			tooltip: {
				enabled: false,
			},
		},
		yaxis: {
			type: 'category',
			categories: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
			reversed: true,
			tooltip: {
				enabled: false,
			},
		},
		tooltip: {
			custom: ({ series, seriesIndex, dataPointIndex, w }) => {
				return `<div class="text-xs bg-surface-gray-7 text-ink-white font-medium p-1">
					<div class="text-center">${heatmap.data.heatmap_data[seriesIndex].data[dataPointIndex].label}</div>
				</div>`
			},
		},
	}
})

const chartSeries = computed(() => {
	if (!heatmap.data) return []
	let series = heatmap.data.heatmap_data.map((row) => {
		return {
			name: row.name,
			data: row.data.map((value) => value.count),
		}
	})
	return series
})
</script>
