<template>
	<div class="flex min-h-0 flex-1 flex-col">
		<PageHeader :breadcrumbs="breadcrumbs">
			<template #actions>
				<Button :variant="askOpen ? 'subtle' : 'outline'" @click="toggleAsk">
					<template #prefix><span class="lucide-sparkles size-4" /></template>
					{{ __('Ask anything') }}
				</Button>
			</template>
		</PageHeader>
		<div class="flex min-h-0 flex-1">
			<main class="flex-1 overflow-y-auto">
				<div class="mx-auto w-full max-w-5xl px-4 py-6 sm:px-5 sm:py-8">
					<div class="flex flex-wrap items-start justify-between gap-3">
						<div>
							<h1 class="text-xl-semibold text-ink-gray-9">
								{{ __("Who's ready") }}
							</h1>
							<p class="mt-1 text-p-base text-ink-gray-6">
								{{
									__('See who has it down, who is stuck, and what to fix next.')
								}}
							</p>
						</div>
						<Button v-if="onlyGoal" :route="{ name: 'Readiness' }">{{
							__('All skills')
						}}</Button>
					</div>

					<EmptyStateLayout
						v-if="readiness.data && !visibleGoals.length"
						name="Goals"
						icon="lucide-gauge"
						:title="__('Nothing published yet')"
						:description="
							__(
								'Publish a skill and you\'ll see who\'s ready here, as it happens.'
							)
						"
					>
						<Button variant="solid" :route="{ name: 'Goals' }">{{
							__('Go to Skills')
						}}</Button>
					</EmptyStateLayout>

					<div
						v-else
						class="mt-6 grid gap-4"
						:class="onlyGoal ? '' : 'md:grid-cols-2'"
					>
						<div
							v-for="goal in visibleGoals"
							:key="goal.goal"
							class="flex flex-col rounded-7 border border-outline-gray-2 bg-surface-base p-5"
						>
							<div class="flex items-start justify-between gap-3">
								<router-link
									:to="{ name: 'GoalBuilder', params: { goal: goal.goal } }"
									class="truncate text-base-medium text-ink-gray-9 hover:underline"
								>
									{{ goal.title }}
								</router-link>
								<span
									v-if="goal.due_date"
									class="shrink-0 text-p-xs text-ink-gray-6"
								>
									{{ __('Due {0}').format(formatDate(goal.due_date)) }}
								</span>
							</div>
							<div class="mt-3 flex items-baseline gap-2">
								<span class="text-2xl-semibold text-ink-gray-9"
									>{{ percentReady(goal) }}%</span
								>
								<span class="text-p-sm text-ink-gray-6">
									{{
										__('ready · {0} of {1} people').format(
											goal.ready,
											goal.assigned
										)
									}}
								</span>
							</div>
							<div
								class="mt-3 flex h-2 overflow-hidden rounded-full bg-surface-gray-2"
							>
								<div
									class="bg-surface-green-3"
									:style="{ width: share(goal.ready, goal) }"
								/>
								<div
									class="bg-surface-amber-2"
									:style="{ width: share(goal.in_progress, goal) }"
								/>
							</div>
							<div class="mt-2 flex gap-4 text-p-xs text-ink-gray-6">
								<span>{{
									__('{0} in progress').format(goal.in_progress)
								}}</span>
								<span>{{
									__('{0} not started').format(goal.not_started)
								}}</span>
								<span v-if="goal.overdue" class="text-ink-red-6">{{
									__('{0} overdue').format(goal.overdue)
								}}</span>
							</div>
							<GoalInsights v-if="goal.insights" :insights="goal.insights" />
							<div class="mt-4 flex justify-end gap-2">
								<Button
									v-if="goal.assigned - goal.ready > 0"
									size="sm"
									:loading="reminding === goal.goal"
									@click="remind(goal)"
								>
									<template #prefix
										><span class="lucide-bell size-3.5"
									/></template>
									{{
										__('Remind {0} people').format(goal.assigned - goal.ready)
									}}
								</Button>
							</div>
						</div>
					</div>

					<section v-if="readiness.data?.people.length" class="mt-10">
						<div class="mb-3 flex flex-wrap items-center justify-between gap-3">
							<h2 class="text-lg-semibold text-ink-gray-9">
								{{ __('People') }}
							</h2>
							<TabButtons v-model="filter" :options="filters" />
						</div>
						<div class="overflow-x-auto rounded-7 border border-outline-gray-2">
							<table class="w-full min-w-[40rem] text-p-sm">
								<thead
									class="bg-surface-gray-1 text-start text-p-xs text-ink-gray-6"
								>
									<tr>
										<th class="px-4 py-2 text-start font-normal">
											{{ __('Person') }}
										</th>
										<th class="px-4 py-2 text-start font-normal">
											{{ __('Goal') }}
										</th>
										<th class="px-4 py-2 text-start font-normal">
											{{ __('Status') }}
										</th>
										<th class="px-4 py-2 text-start font-normal">
											{{ __('Progress') }}
										</th>
										<th class="px-4 py-2 text-end font-normal">
											{{ __('Score') }}
										</th>
									</tr>
								</thead>
								<tbody>
									<tr
										v-for="person in visiblePeople"
										:key="person.name"
										class="cursor-pointer border-t border-outline-gray-1 hover:bg-surface-gray-1"
										@click="openPerson(person)"
									>
										<td class="px-4 py-2.5">
											<div class="flex items-center gap-2">
												<Avatar :label="person.member_name" size="sm" />
												<span class="text-ink-gray-8">{{
													person.member_name
												}}</span>
											</div>
										</td>
										<td class="px-4 py-2.5 text-ink-gray-7">
											{{ person.goal_title }}
										</td>
										<td class="px-4 py-2.5">
											<Badge v-if="person.overdue" theme="red">{{
												__('Overdue')
											}}</Badge>
											<Badge
												v-else
												:theme="
													person.status === 'Ready'
														? 'green'
														: statusTheme(person.status)
												"
											>
												{{
													__(
														person.status === 'Assigned'
															? 'Not started'
															: person.status
													)
												}}
											</Badge>
										</td>
										<td class="w-40 px-4 py-2.5">
											<Progress :value="person.progress || 0" size="sm" />
										</td>
										<td class="px-4 py-2.5 text-end text-ink-gray-7">
											{{ person.score ? `${person.score}%` : '–' }}
										</td>
									</tr>
								</tbody>
							</table>
						</div>
					</section>
				</div>
			</main>

			<aside
				v-if="askOpen"
				class="fixed inset-0 z-40 flex flex-col bg-surface-base md:static md:z-auto md:w-96 md:shrink-0 md:border-s md:border-outline-gray-1"
			>
				<div
					class="flex items-center justify-between border-b border-outline-gray-1 px-4 py-3"
				>
					<div class="text-base-medium text-ink-gray-9">
						{{ __('Ask about readiness') }}
					</div>
					<Button
						variant="ghost"
						:aria-label="__('Close')"
						@click="askOpen = false"
					>
						<template #icon><span class="lucide-x size-4" /></template>
					</Button>
				</div>
				<FlowChat
					:session="askSession"
					:assistant-name="__('AI')"
					:placeholder="__('Who hasn\'t started yet?')"
					:empty-text="
						__(
							'Ask about any skill or person. For example: who is overdue, and what are they stuck on?'
						)
					"
					:tool-labels="toolLabels()"
				/>
			</aside>
		</div>

		<PersonEvidence
			v-model:open="personOpen"
			:assignment="person?.name || null"
			:name="person?.member_name || ''"
			:goal-title="person?.goal_title || ''"
			:sign-off-required="Boolean(person && signOffGoals.has(person.goal))"
			@changed="readiness.reload()"
		/>
	</div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import {
	Avatar,
	Badge,
	Button,
	call,
	createResource,
	Progress,
	TabButtons,
	toast,
	usePageMeta,
} from 'frappe-ui'
import PageHeader from '@/components/Layouts/pages/PageHeader.vue'
import EmptyStateLayout from '@/components/Layouts/EmptyStateLayout.vue'
import FlowChat from '@/components/Goals/FlowChat.vue'
import PersonEvidence from '@/components/Goals/PersonEvidence.vue'
import GoalInsights from '@/components/Goals/GoalInsights.vue'
import {
	percentReady,
	statusTheme,
	toolLabels,
	type Readiness,
} from '@/utils/goals'
import dayjs from '@/utils/dayjs'

interface Person {
	name: string
	member: string
	member_name: string
	goal: string
	goal_title: string
	status: string
	overdue: boolean
	progress: number
	score: number
}

const readiness = createResource({
	url: 'lms.lms.ai.api.readiness',
	auto: true,
})

// Opened from a skill's form, Readiness shows just that skill.
const route = useRoute()
const onlyGoal = computed(() => (route.query.goal as string) || null)
const visibleGoals = computed(() =>
	(readiness.data?.goals || []).filter(
		(goal: { goal: string }) => !onlyGoal.value || goal.goal === onlyGoal.value
	)
)
const breadcrumbs = computed(() => [
	{ label: __('Readiness'), route: { name: 'Readiness' } },
	...(onlyGoal.value && visibleGoals.value[0]
		? [
				{
					label: visibleGoals.value[0].title,
					route: { name: 'Readiness', query: { goal: onlyGoal.value } },
				},
		  ]
		: []),
])
const signOffGoals = ref(new Set<string>())

const filter = ref('all')
const filters = [
	{ label: __('All'), value: 'all' },
	{ label: __('Overdue'), value: 'overdue' },
	{ label: __('Not started'), value: 'Assigned' },
	{ label: __('In progress'), value: 'In Progress' },
	{ label: __('Ready'), value: 'Ready' },
]

const visiblePeople = computed<Person[]>(() =>
	(readiness.data?.people || []).filter(
		(person: Person) =>
			(!onlyGoal.value || person.goal === onlyGoal.value) &&
			(filter.value === 'all'
				? true
				: filter.value === 'overdue'
				? person.overdue
				: person.status === filter.value)
	)
)

const share = (count: number, goal: Readiness) =>
	goal.assigned ? `${(100 * count) / goal.assigned}%` : '0%'

const formatDate = (value: string) => dayjs(value).format('D MMM')

const reminding = ref<string | null>(null)
const remind = async (goal: Readiness & { goal: string }) => {
	reminding.value = goal.goal
	try {
		const members = (readiness.data?.people || [])
			.filter(
				(person: Person) =>
					person.goal === goal.goal && person.status !== 'Ready'
			)
			.map((person: Person) => person.member)
		const sent = await call('lms.lms.ai.api.remind', {
			goal: goal.goal,
			members,
		})
		toast.success(__('Reminded {0} people').format(sent))
	} finally {
		reminding.value = null
	}
}

const person = ref<Person | null>(null)
const personOpen = ref(false)
const openPerson = async (row: Person) => {
	person.value = row
	personOpen.value = true
	if (!signOffGoals.value.has(row.goal)) {
		const goal = await call('lms.lms.ai.api.get_goal', { goal: row.goal })
		if (goal.proof_sign_off)
			signOffGoals.value = new Set([...signOffGoals.value, row.goal])
	}
}

const askOpen = ref(false)
const askSession = ref<string | null>(null)
const toggleAsk = async () => {
	askOpen.value = !askOpen.value
	if (askOpen.value && !askSession.value)
		askSession.value = await call('lms.lms.ai.api.readiness_session')
}

usePageMeta(() => ({ title: __('Readiness') }))
</script>
