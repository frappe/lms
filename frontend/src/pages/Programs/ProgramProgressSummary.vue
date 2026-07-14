<template>
	<Dialog
		v-model:open="show"
		:title="__('Progress Summary for {0}').format(programName)"
		size="2xl"
	>
		<template #default>
			<div class="text-base">
				<div class="flex items-center justify-between gap-x-4 mb-4">
					<NumberChart
						class="border rounded-md w-full"
						:config="{
							title: __('Enrollments'),
							value: programMembers.length || 0,
						}"
					/>
					<NumberChart
						class="border rounded-md w-full"
						:config="{
							title: __('Average Progress %'),
							value: averageProgress || 0,
						}"
					/>
				</div>
				<DonutChart
					:config="{
						data: progressDistribution || [],
						title: __('Progress Distribution'),
						categoryColumn: 'category',
						valueColumn: 'count',
						colors: [
							'var(--red-400)',
							'var(--amber-400)',
							'var(--pink-400)',
							'var(--blue-400)',
							'var(--green-400)',
						],
					}"
				/>

				<div class="mt-10">
					<FormControl
						v-model="searchFilter"
						:placeholder="__('Search')"
						class="mb-4"
					>
						<template #prefix>
							<span class="lucide-search size-4 text-ink-gray-5" />
						</template>
					</FormControl>
					<ListView
						v-if="progressList.length"
						:columns="progressColumns"
						:rows="progressList"
						rowKey="name"
						:options="{
							selectable: false,
							showTooltip: false,
						}"
					/>
					<div v-else class="text-center text-ink-gray-5">
						{{ __('No members found.') }}
					</div>
				</div>
			</div>
		</template>
	</Dialog>
</template>
<script setup lang="ts">
import {
	Dialog,
	DonutChart,
	FormControl,
	ListView,
	NumberChart,
} from 'frappe-ui'
import type { ProgramMember } from './types'
import { computed, ref, watch } from 'vue'

const show = defineModel<boolean>({ default: false })
const searchFilter = ref<string | null>(null)

const props = defineProps<{
	programName: string
	programMembers: ProgramMember[]
}>()

const progressList = ref<ProgramMember[]>(props.programMembers || [])

const progressDistribution = computed(() => {
	const categories = ['0-20%', '20-40%', '40-60%', '60-80%', '80-100%']
	const distribution = categories.map((category) => {
		const [min, max] = category.slice(0, -1).split('-').map(Number)
		return {
			category,
			count: props.programMembers.filter((member) => {
				const progress = member.progress || 0
				return progress >= min && progress < max
			}).length,
		}
	})
	return distribution
})

const averageProgress = computed(() => {
	if (props.programMembers.length === 0) return 0
	const totalProgress = props.programMembers.reduce(
		(sum, member) => sum + (member.progress || 0),
		0
	)
	return totalProgress / props.programMembers.length
})

watch(searchFilter, () => {
	if (searchFilter.value) {
		progressList.value = props.programMembers.filter((member) =>
			member.full_name.toLowerCase().includes(searchFilter.value?.toLowerCase())
		)
	} else {
		progressList.value = props.programMembers
	}
})

const progressColumns = computed(() => {
	return [
		{
			label: __('Member'),
			key: 'full_name',
			width: '50%',
		},
		{
			label: __('Progress (%)'),
			key: 'progress',
			align: 'right',
		},
	]
})
</script>
