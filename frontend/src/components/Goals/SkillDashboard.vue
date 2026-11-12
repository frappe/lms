<template>
	<div class="flex flex-col p-5">
		<EmptyStateLayout
			v-if="dashboard.data && !summary?.assigned"
			name="Skill Dashboard"
			icon="lucide-users"
			:title="__('No students enrolled yet')"
			:description="
				__(
					'Publish it and send it to your students. You will see who has completed it, and where they get stuck, here.'
				)
			"
		/>

		<!-- The numbers across the top; under them the students, and the story beside them.
		     On a wide screen the page stays put and only the list scrolls. -->
		<div
			v-else-if="summary && trends"
			class="flex flex-col gap-5 xl:min-h-0 xl:flex-1"
		>
			<div class="grid shrink-0 grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
				<NumberCard
					v-for="card in cards"
					:key="card.title"
					v-bind="card"
					:delta-caption="__('vs last month')"
				/>
			</div>

			<div
				class="grid grid-cols-1 gap-5 xl:min-h-0 xl:flex-1 xl:grid-cols-[minmax(0,1fr)_27rem]"
			>
				<SkillStudents
					class="xl:h-full"
					:people="people"
					:last-active="trends.last_active"
					:stage="stage"
					:has-rules="trends.has_rules"
					@clear-stage="stage = null"
					@open="openPerson"
				/>

				<div class="flex min-w-0 flex-col gap-5 xl:overflow-y-auto">
					<ChartCard class="h-[240px] shrink-0">
						<FunnelChart
							:title="__('Progress')"
							:data="trends.funnel"
							category="stage"
							value="students"
							@select="selectStage"
						>
							<template #empty>
								<ChartEmpty
									:text="__('Each stage fills in as your students start.')"
								/>
							</template>
						</FunnelChart>
					</ChartCard>
					<ChartCard
						class="h-[300px] shrink-0 xl:h-auto xl:min-h-[260px] xl:flex-1"
					>
						<AreaChart
							v-if="hasActivity"
							:title="__('Over time')"
							:subtitle="__('Running totals since the first enrollment')"
							:data="trends.activity"
							x="date"
							:x-axis="{ timeGrain: 'month' }"
							:y="
								trends.has_rules
									? ['enrolled', 'completed', 'passed']
									: ['enrolled', 'completed']
							"
							:series-config="{
								enrolled: { label: __('Enrolled') },
								completed: { label: __('Completed') },
								passed: { label: __('Passed') },
							}"
						>
						</AreaChart>
						<!-- No legend over nothing: just the title and what will fill it. -->
						<div v-else class="flex h-full flex-col">
							<div class="text-p-base text-ink-gray-8">
								{{ __('Over time') }}
							</div>
							<div class="text-p-sm text-ink-gray-6">
								{{ __('Running totals since the first enrollment') }}
							</div>
							<ChartEmpty
								class="flex-1"
								:text="
									__('This fills in as people enroll and complete the skill.')
								"
							/>
						</div>
					</ChartCard>
					<GoalInsights
						v-if="summary.insights && hasInsights"
						:insights="summary.insights"
						class="!mt-0"
					/>
				</div>
			</div>
		</div>

		<PersonEvidence
			v-model:open="personOpen"
			:assignment="person?.name || null"
			:name="person?.member_name || ''"
			:goal-title="summary?.title || ''"
			:sign-off-required="signOffRequired"
			@changed="dashboard.reload()"
		/>
	</div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { createResource } from 'frappe-ui'
import { AreaChart, ChartCard, FunnelChart, NumberCard } from 'frappe-ui/charts'
import type { FunnelStageEvent } from 'frappe-ui/charts'
import ChartEmpty from '@/components/Goals/ChartEmpty.vue'
import EmptyStateLayout from '@/components/Layouts/EmptyStateLayout.vue'
import GoalInsights from '@/components/Goals/GoalInsights.vue'
import PersonEvidence from '@/components/Goals/PersonEvidence.vue'
import SkillStudents from '@/components/Goals/SkillStudents.vue'
import type { Person, Stage } from '@/components/Goals/SkillStudents.vue'

interface Card {
	value: number | null
	delta: number | null
	trend: (number | null)[]
}

const props = defineProps<{ goal: string; signOffRequired: boolean }>()

const dashboard = createResource({
	url: 'lms.lms.ai.api.skill_dashboard',
	params: { goal: props.goal },
	auto: true,
})
const summary = computed(() => dashboard.data?.summary)
const people = computed<Person[]>(() => dashboard.data?.people || [])
const trends = computed(() => dashboard.data?.trends)

const card = (
	title: string,
	reading: Card,
	type: 'bar' | 'area',
	unit: 'count' | 'percent'
) => ({
	title,
	value: reading.value,
	suffix: unit === 'percent' ? '%' : undefined,
	delta: reading.delta,
	// A rate moves in points; a count moves by a share of itself.
	deltaSuffix: unit === 'percent' ? __(' pts') : '%',
	sparkline: { data: reading.trend, type },
})
const cards = computed(() => {
	const t = trends.value.cards
	return [
		card(__('Enrolled'), t.assigned, 'bar', 'count'),
		card(__('Active (7 days)'), t.active, 'area', 'count'),
		card(
			trends.value.has_rules ? __('Pass rate') : __('Completion rate'),
			t.ready_rate,
			'area',
			'percent'
		),
		card(__('Average score'), t.mastery, 'area', 'percent'),
	]
})

// A quiet chart says why it is empty, instead of drawing flat lines at zero.
const hasActivity = computed(() =>
	trends.value.activity.some((row: Record<string, number>) => row.enrolled)
)

const stage = ref<Stage | null>(null)
const selectStage = (event: FunnelStageEvent) => {
	const row = event.row as Stage
	stage.value = stage.value?.key === row.key ? null : row
}

const hasInsights = computed(() => {
	const insights = summary.value?.insights
	return Boolean(
		insights?.missed_questions?.length ||
			insights?.ideas?.some(
				(idea: { needed_teaching: number; confidently_wrong: number }) =>
					idea.needed_teaching || idea.confidently_wrong
			)
	)
})

const person = ref<Person | null>(null)
const personOpen = ref(false)
const openPerson = (row: Person) => {
	person.value = row
	personOpen.value = true
}
</script>
