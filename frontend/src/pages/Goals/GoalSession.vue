<template>
	<div class="flex min-h-0 flex-1 flex-col">
		<PageHeader
			v-if="!zen"
			:breadcrumbs="breadcrumbs"
			:loading="!state && !overview && !unavailable"
		>
			<template #actions>
				<Badge v-if="isPreview" class="hidden sm:inline-flex" theme="violet">{{
					__('Preview')
				}}</Badge>
				<Button
					v-if="isPreview && state"
					:route="{ name: 'GoalBuilder', params: { goal: state.goal.name } }"
					:aria-label="__('Back to the skill')"
				>
					<template #prefix
						><span class="lucide-arrow-left size-4 sm:hidden"
					/></template>
					<span class="hidden sm:inline">{{ __('Back to the skill') }}</span>
				</Button>
				<Button v-if="state" :aria-label="__('Zen mode')" @click="zen = true">
					<template #prefix><span class="lucide-maximize-2 size-4" /></template>
					<span class="hidden sm:inline">{{ __('Zen mode') }}</span>
				</Button>
				<Button
					v-if="state"
					:variant="tutorOpen ? 'subtle' : 'outline'"
					:aria-label="__('Ask {0}').format(TUTOR_NAME)"
					@click="toggleTutor"
				>
					<template #prefix
						><span class="lucide-message-circle-question size-4"
					/></template>
					<span class="hidden sm:inline">{{
						__('Ask {0}').format(TUTOR_NAME)
					}}</span>
				</Button>
			</template>
		</PageHeader>

		<!-- A link to a skill that is not open to them, or no longer published: say so
		     instead of loading forever. -->
		<EmptyStateLayout
			v-if="unavailable"
			name="Skill"
			icon="lucide-sparkles"
			width="md"
			:title="__('This skill is not open to you')"
			:description="
				__(
					'It may be for a different group, or no longer shared. Your skills are in the Skills list.'
				)
			"
		>
			<Button :route="{ name: 'Goals' }" :label="__('Go to Skills')" />
		</EmptyStateLayout>

		<!-- A skill open to everyone that this learner has not started: what it is,
		     and Start, which enrols them. Looking costs nothing. -->
		<div v-else-if="overview" class="flex-1 overflow-y-auto">
			<div
				class="mx-auto flex w-full max-w-[820px] flex-col items-center px-4 py-10 text-center sm:px-6 sm:py-16"
			>
				<CharacterAvatar who="lumi" mood="happy" class="size-24 sm:size-28" />
				<h1 class="mt-4 text-lg-semibold text-ink-gray-9">
					{{ overview.title }}
				</h1>
				<p
					v-if="overview.outcome"
					class="mt-2 max-w-md text-p-base text-ink-gray-7"
				>
					{{ overview.outcome }}
				</p>
				<ol
					v-if="overview.parts.length"
					class="mt-6 w-full max-w-md divide-y divide-outline-gray-1 rounded-7 border border-outline-gray-2 text-start"
				>
					<li
						v-for="(part, index) in overview.parts"
						:key="index"
						class="flex items-center gap-3 px-4 py-3"
					>
						<span
							class="size-4 shrink-0 text-ink-gray-6"
							:class="activityIcon[part.activity_type]"
							aria-hidden="true"
						/>
						<span class="min-w-0 flex-1 truncate text-p-sm text-ink-gray-9">
							{{ part.title }}
						</span>
						<span class="shrink-0 text-p-xs text-ink-gray-6">
							{{ activityLabel(part.activity_type) }}
						</span>
					</li>
				</ol>
				<p class="mt-4 text-p-sm text-ink-gray-6">{{ overviewMeta }}</p>
				<Button
					class="mt-6"
					variant="solid"
					:label="__('Start')"
					:loading="joining"
					@click="startSkill"
				/>
			</div>
		</div>

		<!-- Zen turns the session into a full-screen overlay: the app shell and
		     step rail go, only the activity (and Lumi, if open) remain. -->
		<div
			v-if="state"
			class="flex min-h-0 flex-1"
			:class="zen ? 'fixed inset-0 z-40 bg-surface-base' : ''"
		>
			<aside
				v-if="!zen"
				class="hidden w-72 shrink-0 flex-col border-e border-outline-gray-1 bg-surface-gray-1 p-5 md:flex"
			>
				<div class="text-base-medium text-ink-gray-9">
					{{ state.goal.title }}
				</div>
				<p class="mt-1 text-p-sm text-ink-gray-6">{{ state.goal.outcome }}</p>
				<!-- The bar shows how far they are; a percentage beside it would say it twice. -->
				<div class="mt-4">
					<p
						v-if="state.goal.due_date"
						class="mb-1.5 text-p-xs text-ink-gray-6"
					>
						{{ __('Due {0}').format(dueLabel) }}
					</p>
					<Progress
						:value="state.assignment.progress || 0"
						size="sm"
						:aria-label="__('Progress')"
					/>
				</div>
				<nav class="mt-6 space-y-0.5" :aria-label="__('Steps')">
					<button
						v-for="step in steps"
						:key="step.key"
						type="button"
						class="flex w-full items-center gap-3 rounded-5 px-2.5 py-2 text-start text-p-sm transition-colors"
						:class="
							step.index === current
								? 'bg-surface-base text-ink-gray-9 shadow-sm'
								: 'text-ink-gray-7 hover:bg-surface-gray-2'
						"
						:aria-current="step.index === current ? 'step' : undefined"
						@click="current = step.index"
					>
						<span
							class="size-4 shrink-0"
							:class="
								step.done
									? 'lucide-circle-check text-ink-gray-9'
									: step.icon + ' text-ink-gray-6'
							"
						/>
						<span class="min-w-0 flex-1 truncate">{{ step.title }}</span>
						<span v-if="step.minutes" class="shrink-0 text-p-xs text-ink-gray-6"
							>{{ step.minutes }}m</span
						>
					</button>
				</nav>
			</aside>

			<div class="relative flex min-w-0 flex-1 flex-col">
				<div
					v-if="zen"
					class="absolute end-4 top-4 z-10 flex items-center gap-1"
				>
					<Button
						variant="ghost"
						:aria-label="__('Ask {0}').format(TUTOR_NAME)"
						@click="toggleTutor"
					>
						<template #icon
							><span class="lucide-message-circle-question size-4"
						/></template>
					</Button>
					<Button
						variant="ghost"
						:aria-label="__('Leave zen mode')"
						@click="zen = false"
					>
						<template #icon><span class="lucide-minimize-2 size-4" /></template>
					</Button>
				</div>
				<main class="flex flex-1 flex-col overflow-y-auto">
					<div
						class="w-full"
						:class="
							fullBleed
								? 'flex min-h-0 flex-1 flex-col'
								: isChatStep
								? 'mx-auto flex min-h-0 max-w-5xl flex-1 flex-col px-5 py-8'
								: 'mx-auto max-w-2xl px-5 py-8'
						"
					>
						<div class="md:hidden" :class="fullBleed ? 'px-4 pt-4' : 'mb-5'">
							<Dropdown :options="stepOptions">
								<Button class="w-full justify-between">
									<span class="truncate"
										>{{
											__('Step {0} of {1}').format(current + 1, steps.length)
										}}
										· {{ steps[current]?.title }}</span
									>
									<template #suffix
										><span class="lucide-chevron-down size-4"
									/></template>
								</Button>
							</Dropdown>
							<Progress
								class="mt-2"
								:value="state.assignment.progress || 0"
								size="sm"
							/>
						</div>
						<template v-if="activity">
							<div v-if="!fullBleed" class="mb-1 text-p-xs text-ink-gray-6">
								{{
									activity.activity_type === 'Lesson' && state.goal.tutor_first
										? __('Learn with {0}').format(TUTOR_NAME)
										: activityLabel(activity.activity_type)
								}}
								<span class="hidden md:inline"
									>·
									{{
										__('Step {0} of {1}').format(current + 1, steps.length)
									}}</span
								>
							</div>
							<h1
								v-if="!fullBleed"
								class="mb-5 text-xl-semibold text-ink-gray-9"
							>
								{{ activity.title }}
							</h1>
							<TeachStep
								v-if="
									activity.activity_type === 'Lesson' && state.goal.tutor_first
								"
								class="min-h-0 flex-1"
								:activity="activity"
								:assignment="assignment"
								:ideas="state.ideas"
								:step-label="stepLabel"
								@live="(live) => (stepLive = live)"
								@refresh="load"
								@next="next"
							/>
							<LessonStep
								v-else-if="activity.activity_type === 'Lesson'"
								:activity="activity"
								:submitting="submitting"
								@submit="submitLesson"
							/>
							<ScenarioStep
								v-else-if="activity.activity_type === 'Scenario'"
								:activity="activity"
								:assignment="assignment"
								@answered="applyState"
								@next="next"
							/>
							<CheckStep
								v-else-if="activity.activity_type === 'Check'"
								:activity="activity"
								:assignment="assignment"
								@answered="applyState"
								@next="next"
							/>
							<RolePlayStep
								v-else-if="activity.activity_type === 'Role-play'"
								class="min-h-0 flex-1"
								:activity="activity"
								:assignment="assignment"
								:step-label="stepLabel"
								@live="(live) => (stepLive = live)"
								@refresh="load"
								@next="next"
							/>
						</template>
						<template v-else>
							<FinishStep
								:goal="state.goal"
								:assignment="state.assignment"
								:requirements="requirements"
								:member-name="memberName"
								:activities="state.activities"
								:ideas="state.ideas || []"
								@changed="load"
								@open="(index) => (current = index)"
							/>
						</template>
					</div>
				</main>
			</div>

			<aside
				v-if="tutorOpen"
				class="fixed inset-0 z-40 flex flex-col bg-surface-base md:static md:z-auto md:w-96 md:shrink-0 md:border-s md:border-outline-gray-1"
			>
				<div class="flex gap-3 border-b border-outline-gray-1 px-4 py-3">
					<span class="relative mt-0.5 shrink-0">
						<CharacterAvatar who="lumi" class="size-8" />
						<span
							class="absolute -bottom-0.5 -end-0.5 size-2.5 rounded-full border-2 border-outline-base bg-surface-green-5"
							aria-hidden="true"
						/>
					</span>
					<div class="min-w-0 flex-1">
						<div class="flex h-7 items-center justify-between gap-2">
							<span class="text-p-base font-semibold text-ink-gray-9">{{
								__('Ask {0}').format(TUTOR_NAME)
							}}</span>
							<Button
								variant="ghost"
								size="sm"
								icon="lucide-x"
								class="-me-1.5"
								:aria-label="__('Close')"
								@click="tutorOpen = false"
							/>
						</div>
						<div class="text-p-xs text-ink-gray-6">
							{{ __('Answers come only from the material for this skill') }}
						</div>
					</div>
				</div>
				<FlowChat
					:session="tutorSession"
					:assistant-name="TUTOR_NAME"
					character="lumi"
					:placeholder="__('Ask {0} a question', [TUTOR_NAME])"
					:empty-text="
						__(
							'Stuck on something? Ask in your own words, and I\'ll answer straight from the material.'
						)
					"
					:quick-replies="tutorAsked ? [] : tutorStarters"
					:message-actions="['simpler', 'source']"
					:waiting-text="__('{0} is looking it up', [TUTOR_NAME])"
					:tool-labels="toolLabels()"
					@messages="(count) => (tutorAsked = count > 0)"
				/>
			</aside>
		</div>
	</div>
</template>

<script setup lang="ts">
import EmptyStateLayout from '@/components/Layouts/EmptyStateLayout.vue'
import {
	computed,
	inject,
	onMounted,
	onUnmounted,
	provide,
	ref,
	watch,
} from 'vue'
import { TUTOR_NAME } from '@/utils/characters'
import { useSidebar } from '@/stores/sidebar'
import CharacterAvatar from '@/components/Goals/CharacterAvatar.vue'
import { useRoute } from 'vue-router'
import {
	Badge,
	Button,
	Dropdown,
	Progress,
	call,
	toast,
	usePageMeta,
} from 'frappe-ui'
import PageHeader from '@/components/Layouts/pages/PageHeader.vue'
import FlowChat from '@/components/Goals/FlowChat.vue'
import LessonStep from '@/components/Goals/steps/LessonStep.vue'
import TeachStep from '@/components/Goals/steps/TeachStep.vue'
import ScenarioStep from '@/components/Goals/steps/ScenarioStep.vue'
import CheckStep from '@/components/Goals/steps/CheckStep.vue'
import RolePlayStep from '@/components/Goals/steps/RolePlayStep.vue'
import FinishStep from '@/components/Goals/steps/FinishStep.vue'
import {
	type ActivityType,
	activityIcon,
	activityLabel,
	sourceLinkFor,
	toolLabels,
} from '@/utils/goals'
import dayjs from '@/utils/dayjs'

const props = defineProps<{ goal: string }>()
// The URL carries the goal's slug; the member's own assignment is looked up from it.
const assignment = ref<string | null>(null)
const route = useRoute()
const user = inject<{ data?: { full_name?: string } }>('$user')

const state = ref<Record<string, any> | null>(null)
const requirements = ref<Record<string, boolean>>({})
const current = ref(0)
const submitting = ref(false)
const tutorOpen = ref(false)
const tutorSession = ref<string | null>(null)
const tutorAsked = ref(false)
// Starter questions come from the skill's own key ideas, so they always have an answer.
const tutorStarters = computed(() =>
	(state.value?.ideas || [])
		.slice(0, 3)
		.map((idea: { heading: string }) =>
			__('Can you explain "{0}"?', [idea.heading])
		)
)
const zen = ref(false)

// A lesson wants the room: collapse the main sidebar for the session only.
// Leaving restores the stored preference, which an explicit toggle during the
// session also updates — so that toggle survives, the auto-collapse does not.
const sidebarStore = useSidebar()
const onKeydown = (e: KeyboardEvent) => {
	if (e.key === 'Escape' && zen.value) zen.value = false
}
onMounted(() => {
	sidebarStore.isSidebarCollapsed = true
	window.addEventListener('keydown', onKeydown)
})
onUnmounted(() => {
	sidebarStore.isSidebarCollapsed = JSON.parse(
		localStorage.getItem('isSidebarCollapsed') || 'false'
	)
	window.removeEventListener('keydown', onKeydown)
})

const isPreview = computed(() => route.query.preview === '1')

provide('goalSourceLink', (source: string) =>
	sourceLinkFor(
		{ assignment: assignment.value || '' },
		state.value?.goal.documents || []
	)(source)
)
const memberName = computed(() => user?.data?.full_name || '')

const steps = computed(() => [
	...(state.value?.activities || []).map((a: Record<string, any>) => ({
		key: a.index,
		index: a.index,
		title: a.title,
		minutes: a.minutes,
		done: a.done,
		icon: activityIcon[a.activity_type as keyof typeof activityIcon],
	})),
	{
		key: 'finish',
		index: state.value?.activities.length ?? 0,
		title: __('Finish'),
		minutes: 0,
		done: state.value?.assignment.status === 'Ready',
		icon: 'lucide-flag',
	},
])

const activity = computed(() => state.value?.activities[current.value])
const stepOptions = computed(() =>
	steps.value.map((step) => ({
		label: step.title,
		icon: step.done ? 'lucide-circle-check' : step.icon,
		onClick: () => (current.value = step.index),
	}))
)
// A live conversation (the lesson with Lumi, a role-play) fills the page and brings its own header.
const stepLive = ref(false)
watch(current, () => (stepLive.value = false))
const fullBleed = computed(() => isChatStep.value && stepLive.value)
const stepLabel = computed(() =>
	__('step {0} of {1}', [current.value + 1, steps.value.length])
)

// Conversations get the full height and a wider column; other steps read better narrow.
const isChatStep = computed(
	() =>
		activity.value?.activity_type === 'Role-play' ||
		(activity.value?.activity_type === 'Lesson' &&
			Boolean(state.value?.goal.tutor_first))
)

const dueLabel = computed(() =>
	state.value?.goal.due_date
		? dayjs(state.value.goal.due_date).format('D MMM')
		: ''
)

const load = async () => {
	if (!assignment.value) return
	const first = !state.value
	state.value = await call('lms.lms.ai.api.session_state', {
		assignment: assignment.value,
	})
	const activities = state.value!.activities
	requirements.value = {
		activities: activities.every((a: Record<string, any>) => a.done),
		mastery:
			!state.value!.goal.proof_mastery ||
			state.value!.assignment.score >= state.value!.goal.mastery_threshold,
		acknowledgement:
			!state.value!.goal.proof_acknowledgement ||
			Boolean(state.value!.assignment.acknowledged_on),
		sign_off:
			!state.value!.goal.proof_sign_off ||
			Boolean(state.value!.assignment.signed_off_by),
	}
	if (first)
		current.value = Math.min(
			state.value!.assignment.current_step || 0,
			activities.length
		)
}

const applyState = () => load()

const next = () => {
	current.value = Math.min(current.value + 1, steps.value.length - 1)
}

const submitLesson = async () => {
	submitting.value = true
	try {
		await call('lms.lms.ai.api.submit_activity', {
			assignment: assignment.value,
			index: current.value,
			response: {},
		})
		await load()
		next()
	} finally {
		submitting.value = false
	}
}

const toggleTutor = async () => {
	tutorOpen.value = !tutorOpen.value
	if (tutorOpen.value && !tutorSession.value)
		tutorSession.value = await call('lms.lms.ai.api.tutor_session', {
			assignment: assignment.value,
		})
}

type Overview = {
	name: string
	title: string
	outcome?: string
	minutes?: number
	parts: { activity_type: ActivityType; title: string; minutes?: number }[]
	enrolled_count: number
}

// A skill open to everyone that this learner has not started yet.
const overview = ref<Overview | null>(null)
const unavailable = ref(false)
const joining = ref(false)

const overviewMeta = computed(() => {
	if (!overview.value) return ''
	const parts = [
		overview.value.minutes
			? __('About {0} minutes').format(overview.value.minutes)
			: '',
		overview.value.enrolled_count
			? __('{0} enrolled').format(overview.value.enrolled_count)
			: '',
	]
	return parts.filter(Boolean).join(' · ')
})

const openSession = async () => {
	assignment.value = await call('lms.lms.ai.api.my_assignment', {
		goal: props.goal,
		preview: isPreview.value ? 1 : 0,
	})
	overview.value = null
	load()
}

const startSkill = async () => {
	joining.value = true
	try {
		await call('lms.lms.home.join_skill', { goal: props.goal })
		await openSession()
	} catch (error: any) {
		toast.error(error?.messages?.[0] || __('Could not start this skill.'))
	} finally {
		joining.value = false
	}
}

watch(
	() => [props.goal, isPreview.value] as const,
	async () => {
		state.value = null
		tutorSession.value = null
		assignment.value = null
		overview.value = null
		unavailable.value = false
		const found = await call('lms.lms.ai.api.my_assignment', {
			goal: props.goal,
			preview: isPreview.value ? 1 : 0,
		}).catch(() => null)
		if (found) {
			assignment.value = found
			load()
		} else if (!isPreview.value) {
			overview.value = await call('lms.lms.ai.api.skill_overview', {
				goal: props.goal,
			}).catch(() => null)
			unavailable.value = !overview.value
		}
	},
	{ immediate: true }
)

const breadcrumbs = computed(() => [
	isPreview.value
		? { label: __('Skills'), route: { name: 'Goals' } }
		: { label: __('Home'), route: { name: 'Home' } },
	{
		label:
			state.value?.goal.title ||
			overview.value?.title ||
			(unavailable.value ? __('Skill') : ''),
		route: { name: 'GoalSession', params: { goal: props.goal } },
	},
])

usePageMeta(() => ({
	title: state.value?.goal.title || overview.value?.title || __('Skills'),
}))
</script>
