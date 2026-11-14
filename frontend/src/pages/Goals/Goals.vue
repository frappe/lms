<template>
	<div class="flex min-h-0 flex-1 flex-col">
		<PageHeader
			:breadcrumbs="[{ label: __('Skills'), route: { name: 'Goals' } }]"
		>
			<template v-if="canBuild" #actions>
				<Button variant="solid" @click="openNew()">
					<template #prefix><span class="lucide-plus size-4" /></template>
					{{ __('New skill') }}
				</Button>
			</template>
		</PageHeader>
		<div class="flex flex-1 flex-col overflow-y-auto">
			<EmptyStateLayout
				v-if="source.data && !source.data.length"
				name="Skills"
				icon="lucide-sparkles"
				width="md"
				:title="
					canBuild
						? __('Turn what you know into skills people can prove')
						: __('Practise one thing until you can do it')
				"
				:description="
					canBuild
						? __(
								'Click New skill and say what people should be able to do. AI drafts the lessons, practice and checks.'
						  )
						: __(
								'A tutor first, then practice and a short check. Skills shared with you show up here.'
						  )
				"
			/>
			<div v-else-if="source.data" class="w-full px-5 pb-7 pt-5">
				<AISetupNotice v-if="canBuild" />
				<div
					class="mb-5 flex flex-col justify-between gap-4 md:flex-row md:items-center"
				>
					<h1 class="text-lg-semibold text-ink-gray-9">
						{{ __('All Skills') }}
					</h1>
					<div class="flex flex-wrap items-center gap-3">
						<TabButtons v-model="tab" :options="tabs" class="!w-fit shrink-0" />
						<FormControl
							v-model="search"
							type="text"
							class="w-full sm:w-44"
							:placeholder="__('Search')"
							:aria-label="__('Search')"
						>
							<template #prefix>
								<span class="lucide-search size-4 text-ink-gray-6" />
							</template>
						</FormControl>
					</div>
				</div>

				<EmptyStateLayout
					v-if="!shown.length"
					name="Skills"
					icon="lucide-sparkles"
					width="md"
					:title="emptyState.title"
					:description="emptyState.description"
				>
					<EmptyStateActions
						v-if="canBuild && !search.trim()"
						list="skills"
						:tab="tab"
						:create-label="__('New skill')"
						@create="openNew()"
					/>
				</EmptyStateLayout>
				<div
					v-else
					class="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
				>
					<SkillCard
						v-for="goal in shownGoals"
						:key="goal.name"
						:title="isUntitled(goal) ? __('Untitled skill') : goal.title"
						:description="
							goal.learner_outcome ||
							goal.outcome ||
							__(
								'Say what people should be able to do, then add your material.'
							)
						"
						:top-line="
							goal.status === 'Published' && goal.due_date
								? __('Due {0}').format(formatDate(goal.due_date))
								: ''
						"
						:badge="goal.status === 'Published' ? null : draftState(goal)"
						:instructor="goal.status === 'Published' ? goal.instructor : null"
						:meta="meta(goal)"
						:to="{ name: 'GoalBuilder', params: { goal: goal.name } }"
					/>
					<SkillCard
						v-for="skill in shownSkills"
						:key="skill.name"
						v-bind="learnerCard(skill)"
					/>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, inject, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
	Button,
	createResource,
	FormControl,
	TabButtons,
	usePageMeta,
} from 'frappe-ui'
import PageHeader from '@/components/Layouts/pages/PageHeader.vue'
import EmptyStateLayout from '@/components/Layouts/EmptyStateLayout.vue'
import EmptyStateActions from '@/components/EmptyStateActions.vue'
import AISetupNotice from '@/components/Goals/AISetupNotice.vue'
import SkillCard from '@/components/Goals/SkillCard.vue'
import dayjs from '@/utils/dayjs'
import {
	learnerCard,
	type LearnerSkill,
	NEW,
	type Readiness,
	UNTITLED,
} from '@/utils/goals'

interface GoalRow {
	name: string
	title: string
	status: 'Draft' | 'Drafting' | 'Ready' | 'Published'
	outcome?: string
	learner_outcome?: string
	due_date?: string
	minutes?: number
	activities: number
	readiness?: Readiness | null
	instructor?: { name: string; full_name: string; image?: string }
}

const router = useRouter()
const user = inject<any>('$user')
// Only Learning admins build skills; everyone else sees the skills they can take.
const canBuild = computed(
	() => user.data?.is_moderator || user.data?.is_system_manager
)
const search = ref('')
const tab = ref<'published' | 'created' | 'enrolled'>('published')

const goals = createResource({
	url: 'lms.lms.ai.api.list_goals',
	auto: canBuild.value,
	onSuccess: (rows: GoalRow[]) => {
		if (!rows.some((row) => row.status === 'Published')) tab.value = 'created'
	},
})

// The builder creates the skill on the first thing done in it, so looking and leaving
// leaves nothing behind.
const openNew = () =>
	router.push({ name: 'GoalBuilder', params: { goal: NEW } })

const skills = createResource({
	url: 'lms.lms.ai.api.learner_skills',
	auto: !canBuild.value,
})

const source = computed(() => (canBuild.value ? goals : skills))

const rows = computed<GoalRow[]>(() => goals.data || [])
const published = computed(() =>
	rows.value.filter((goal) => goal.status === 'Published')
)
const created = computed(() =>
	rows.value.filter((goal) => goal.status !== 'Published')
)

const tabs = computed(() =>
	canBuild.value
		? [
				{ value: 'published', label: __('Published') },
				{ value: 'created', label: __('Created') },
		  ]
		: [
				{ value: 'published', label: __('Published') },
				{ value: 'enrolled', label: __('Enrolled') },
		  ]
)

const matches = (title: string) =>
	title.toLowerCase().includes(search.value.trim().toLowerCase())

const shownGoals = computed(() =>
	(tab.value === 'published' ? published.value : created.value).filter((goal) =>
		matches(goal.title)
	)
)

const shownSkills = computed(() =>
	((skills.data || []) as LearnerSkill[]).filter(
		(skill) =>
			(tab.value !== 'enrolled' || skill.enrolled) && matches(skill.title)
	)
)

const shown = computed(() =>
	canBuild.value ? shownGoals.value : shownSkills.value
)

// The empty state for one tab or search, in the shape the Courses and Batches lists use.
const emptyState = computed(() => {
	const query = search.value.trim()
	if (query)
		return {
			title: __('No skills match "{0}"').format(query),
			description: __('Check the spelling, or try a shorter word.'),
		}
	if (!canBuild.value)
		return tab.value === 'enrolled'
			? {
					title: __('Nothing enrolled yet'),
					description: __('Start a skill from Published and it shows up here.'),
			  }
			: {
					title: __('No skills open to everyone yet'),
					description: __(
						'Skills shared with you show up here as soon as they are published.'
					),
			  }
	return tab.value === 'published'
		? {
				title: __('Nothing published yet'),
				description: __(
					'Publish a skill to send it to your people. Your drafts are under Created.'
				),
		  }
		: {
				title: __('Every skill you made is published'),
				description: __(
					'Start a new one here, and it waits in this tab until you publish it.'
				),
		  }
})

const isUntitled = (goal: GoalRow) => goal.title === UNTITLED

const formatDate = (date: string) => dayjs(date).format('D MMM')

const planSummary = (goal: GoalRow) =>
	goal.minutes
		? __('{0} parts · {1} min').format(goal.activities, goal.minutes)
		: __('{0} parts').format(goal.activities)

const meta = (goal: GoalRow) => {
	if (goal.status === 'Published')
		return goal.readiness?.assigned
			? __('{0} enrolled').format(goal.readiness.assigned)
			: __('No one enrolled yet')
	if (goal.activities) return planSummary(goal)
	if (!isUntitled(goal) && goal.status !== 'Drafting') return __('No plan yet')
	return ''
}

const draftState = (goal: GoalRow) => {
	if (goal.status === 'Ready')
		return { label: __('Ready to publish'), theme: 'blue' }
	if (goal.status === 'Drafting')
		return { label: __('Building the plan'), theme: 'amber' }
	return { label: __('Draft'), theme: 'gray' }
}

usePageMeta(() => ({ title: __('Skills') }))
</script>
