<template>
	<div
		data-slot="dashboard-kpis"
		class="grid shrink-0 grid-cols-2 gap-5 md:grid-cols-4 lg:grid-cols-2 min-[1400px]:grid-cols-4"
	>
		<component
			:is="kpi.select ? 'button' : 'div'"
			v-for="kpi in kpis"
			:key="kpi.key"
			data-slot="dashboard-kpi"
			class="flex min-w-0 rounded-4 text-start"
			:class="kpi.select && cardClass(kpi.select.pressed)"
			:type="kpi.select ? 'button' : undefined"
			:aria-pressed="kpi.select ? kpi.select.pressed : undefined"
			:title="kpi.select?.label"
			@click="kpi.select?.onSelect()"
		>
			<NumberCard
				:title="kpi.title"
				:value="kpi.value"
				:color="kpi.color"
				:suffix="kpi.suffix"
				:target="kpi.target"
				:format="kpi.format"
				:loading="loading"
				:delta="kpi.delta || null"
				:delta-suffix="kpi.deltaSuffix"
				:delta-format="kpi.deltaFormat"
				:delta-caption="kpi.delta ? lastMonth : kpi.fallbackCaption"
				:negative-is-better="kpi.negativeIsBetter"
				:sparkline="kpi.sparkline"
			>
				<template v-if="$slots[`empty-${kpi.key}`]" #empty>
					<slot :name="`empty-${kpi.key}`" :kpi="kpi" />
				</template>
			</NumberCard>
		</component>
	</div>
</template>
<script setup lang="ts">
import { NumberCard } from 'frappe-ui/charts'
import { computed } from 'vue'
import type { DashboardKpi } from '@/types'

defineProps<{
	kpis: DashboardKpi[]
	loading: boolean
}>()

const lastMonth = computed<string>(() => __('vs last month'))

// A pressed card takes the focus look of a text input.
const FOCUSED = '[&>*]:!border-outline-gray-4 [&>*]:shadow-sm'

const cardClass = (pressed: boolean): string[] => [
	'cursor-pointer touch-manipulation outline-none',
	'focus-visible:[&>*]:!border-outline-gray-4 focus-visible:[&>*]:shadow-sm',
	'[@media(hover:hover)]:hover:[&>*]:!border-outline-gray-3',
	pressed ? FOCUSED : '',
]
</script>
