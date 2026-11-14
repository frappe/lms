<template>
	<div class="flex min-h-0 flex-1 flex-col">
		<PageHeader
			:breadcrumbs="breadcrumbs"
			:published="goal?.status === 'Published'"
			:loading="!goal && !loadError"
		>
			<template #actions>
				<span
					v-if="saving"
					class="hidden text-p-sm text-ink-gray-6 sm:inline"
					>{{ __('Saving…') }}</span
				>
				<Button
					v-if="goal?.activities?.length"
					:loading="preview.loading"
					:aria-label="__('Preview as a learner')"
					@click="preview.submit({ goal: goalName })"
				>
					<template #prefix><span class="lucide-play size-4" /></template>
					<span class="hidden md:inline">{{ __('Preview as a learner') }}</span>
				</Button>
				<Button
					v-if="goal?.activities?.length && goal.status !== 'Published'"
					variant="solid"
					:loading="publish.loading"
					@click="publish.submit({ goal: goalName })"
				>
					<template #prefix><span class="lucide-rocket size-4" /></template>
					{{ __('Publish') }}
				</Button>
				<Dropdown
					v-if="goal && !isNew"
					:options="goalOptions"
					:button="{
						icon: 'lucide-ellipsis',
						variant: 'ghost',
						label: __('Skill options'),
					}"
				/>
			</template>
		</PageHeader>

		<!-- The same two-tab frame as a course: build it, then see how people do. -->
		<Tabs v-if="goal" v-model="tab" :tabs="tabs" class="skill-tabs">
			<template #tab-prefix="{ tab: item }">
				<span class="size-4" :class="item.data?.icon" />
			</template>
			<template #tab-label="{ tab: item }">
				<span class="text-p-base">{{ item.data?.label }}</span>
			</template>
			<template #tab-panel="{ tab: item }">
				<SkillDashboard
					v-if="item.value === 'dashboard'"
					class="min-h-0 flex-1 overflow-y-auto xl:overflow-hidden"
					:goal="goalName"
					:sign-off-required="Boolean(goal.proof_sign_off)"
				/>
				<div
					v-else
					class="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden"
				>
					<aside
						class="flex w-full shrink-0 flex-col border-b border-outline-gray-1 bg-surface-base lg:min-h-0 lg:w-[24rem] lg:overflow-y-auto lg:border-b-0 lg:border-e"
					>
						<div class="flex flex-col gap-5 px-4 py-6 sm:px-6">
							<AISetupNotice />
							<InlineEdit
								v-model="goal.title"
								text-class="text-xl-semibold text-ink-gray-9"
								:label="__('Title')"
								:placeholder="__('Name this skill')"
								@save="save()"
							/>
							<SourcesPanel
								:goal="goalName"
								:sources="goal.sources"
								:files="parseFiles(goal.source_files)"
								@changed="(sources) => (goal.sources = sources)"
							/>
							<div class="flex flex-col gap-2.5">
								<OutcomeField
									v-model="goal.outcome"
									:goal="goalName"
									:hasMaterial="hasMaterial"
									:reading="reading"
									@save="save()"
								/>
							</div>
							<div class="space-y-1.5">
								<Button
									class="w-full"
									:variant="goal.activities.length ? 'subtle' : 'solid'"
									:loading="draft.loading || goal.status === 'Drafting'"
									:disabled="!canBuild"
									@click="build()"
								>
									<template #prefix
										><span class="lucide-sparkles size-4"
									/></template>
									{{
										goal.status === 'Drafting'
											? __('Building…')
											: goal.activities.length
											? __('Rebuild the plan')
											: __('Build the plan')
									}}
								</Button>
								<ErrorMessage
									v-if="goal.draft_error || draft.error"
									:message="goal.draft_error || draft.error"
								/>
							</div>
						</div>
					</aside>

					<main class="flex flex-1 flex-col lg:overflow-y-auto">
						<EmptyStateLayout
							v-if="!goal.activities.length && goal.status !== 'Drafting'"
							name="Plan"
							icon="lucide-sparkles"
							:title="__('Your plan takes shape here')"
							:description="
								__(
									'Build it once your material is ready. You review it before anyone sees it.'
								)
							"
						/>
						<div v-else class="w-full px-5 py-6">
							<Tabs v-model="section">
								<TabList class="!px-0">
									<TabTrigger value="plan" :label="__('Plan')" />
									<TabTrigger
										v-if="!isNew"
										value="settings"
										:label="__('Settings')"
									/>
								</TabList>
								<TabPanel value="settings">
									<GoalSettings :goal="goal" @change="save()" />
								</TabPanel>
								<TabPanel value="plan">
									<section
										v-if="goal.status === 'Drafting' && goal.drafting_session"
										class="mt-4 flex h-80 flex-col overflow-hidden rounded-7 border border-outline-gray-2 bg-surface-base"
									>
										<div
											class="flex items-center gap-2 border-b border-outline-gray-1 px-4 py-3"
										>
											<LoadingIndicator class="size-4" />
											<div>
												<div class="text-base-medium text-ink-gray-9">
													{{ __('Building your plan') }}
												</div>
												<div class="text-p-xs text-ink-gray-6">
													{{
														__(
															'Reading your material and shaping lessons, practice and a check. This takes about a minute.'
														)
													}}
												</div>
											</div>
										</div>
										<FlowChat
											:session="goal.drafting_session"
											:assistant-name="__('AI')"
											:tool-labels="toolLabels()"
											hide-first-message
											read-only
										/>
									</section>
									<template v-if="goal.activities.length">
										<p class="pt-4 text-p-base text-ink-gray-6">
											{{
												__('{0} parts · about {1} minutes').format(
													goal.activities.length,
													goal.minutes
												)
											}}
										</p>
										<Draggable
											v-model="goal.activities"
											item-key="name"
											handle=".activity-handle"
											ghost-class="opacity-50"
											@end="save(true)"
										>
											<template #item="{ element: activity, index }">
												<ActivityCard
													:activity="activity"
													:first="index === 0"
													:last="index === goal.activities.length - 1"
													:tutor-first="goal.tutor_first"
													:check-questions="goal.check_questions"
													:revising="revisions[activity.name] === 'running'"
													:error="revisionErrors[activity.name]"
													@revise="
														(request) => revise(activity.name, index, request)
													"
													@change="save(true)"
													@check-questions="
														(count) => {
															goal.check_questions = count
															save()
														}
													"
													@move="(step) => move(index, step)"
													@remove="remove(index)"
												/>
											</template>
										</Draggable>
									</template>
								</TabPanel>
							</Tabs>
						</div>
					</main>
				</div>
			</template>
		</Tabs>

		<EmptyStateLayout
			v-else-if="loadError"
			name="Skills"
			icon="lucide-sparkles"
			width="md"
			:title="__('This skill is no longer here')"
			:description="__('It was deleted, or the link is out of date.')"
		>
			<Button :route="{ name: 'Goals' }" :label="__('Back to Skills')" />
		</EmptyStateLayout>
	</div>
</template>

<script setup lang="ts">
import { computed, inject, onBeforeUnmount, provide, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Draggable from 'vuedraggable'
import {
	Button,
	call,
	createResource,
	Dropdown,
	ErrorMessage,
	LoadingIndicator,
	TabList,
	TabPanel,
	Tabs,
	TabTrigger,
	toast,
	usePageMeta,
} from 'frappe-ui'
import type { Socket } from 'socket.io-client'
import PageHeader from '@/components/Layouts/pages/PageHeader.vue'
import EmptyStateLayout from '@/components/Layouts/EmptyStateLayout.vue'
import AISetupNotice from '@/components/Goals/AISetupNotice.vue'
import SourcesPanel from '@/components/Goals/SourcesPanel.vue'
import OutcomeField from '@/components/Goals/OutcomeField.vue'
import InlineEdit from '@/components/Goals/InlineEdit.vue'
import ActivityCard from '@/components/Goals/ActivityCard.vue'
import GoalSettings from '@/components/Goals/GoalSettings.vue'
import FlowChat from '@/components/Goals/FlowChat.vue'
import SkillDashboard from '@/components/Goals/SkillDashboard.vue'
import { NEW, sourceLinkFor, toolLabels, UNTITLED } from '@/utils/goals'
import { createDialog } from '@/utils/dialogs'

const props = defineProps<{ goal: string }>()
const goalName = computed(() => props.goal)
const router = useRouter()
const route = useRoute()

const tabs = computed(() => [
	{ value: 'build', data: { label: __('Editor'), icon: 'lucide-sparkles' } },
	...(isNew.value
		? []
		: [
				{
					value: 'dashboard',
					data: { label: __('Dashboard'), icon: 'lucide-trending-up' },
				},
		  ]),
])
// The tab lives in the hash, as on a course, so a link can open the dashboard.
// Any other hash is not ours: Settings opens through it, and must not be cleared.
const isTabHash = (hash: string) => hash === '' || hash === '#dashboard'
const tab = ref(route.hash === '#dashboard' ? 'dashboard' : 'build')
watch(tab, (value) => {
	const hash = value === 'dashboard' ? '#dashboard' : ''
	if (isTabHash(route.hash) && route.hash !== hash)
		router.replace({ ...route, hash })
})
// A link to #dashboard opened while the skill is already showing.
watch(
	() => route.hash,
	(hash) => {
		if (isTabHash(hash)) tab.value = hash ? 'dashboard' : 'build'
	}
)
// The editor column shows the plan or the skill's settings.
const section = ref<'plan' | 'settings'>('plan')
const socket = inject<Socket>('$socket')

const goal = ref<Record<string, any> | null>(null)
// A skill that is gone, or a wrong link, is said so instead of a skeleton forever.
const loadError = ref('')

const parseFiles = (files: unknown): Record<string, string> =>
	typeof files === 'string'
		? JSON.parse(files || '{}')
		: (files as Record<string, string>) || {}

provide('goalSourceLink', (source: string) =>
	sourceLinkFor(
		{ goal: goalName.value },
		goal.value?.documents || Object.keys(parseFiles(goal.value?.source_files))
	)(source)
)
const saving = ref(false)
const CHECKS = [
	'proof_mastery',
	'proof_acknowledgement',
	'proof_sign_off',
	'proof_certificate',
	'assign_everyone',
	'tutor_first',
]

const normalise = (data: Record<string, any>) => {
	for (const field of CHECKS) data[field] = Boolean(data[field])
	return data
}

// /skills/new is a skill that does not exist yet: it is created on the first thing you
// do in it (a title, an outcome, material, Build), with whatever you typed so far.
const isNew = computed(() => goalName.value === NEW)
let creating: Promise<string> | null = null
// The route changes to the created skill, which would reload it over what was typed meanwhile.
let justCreated: string | null = null
const ensureGoal = (): Promise<string> => {
	if (!isNew.value) return Promise.resolve(goalName.value)
	creating ??= call('lms.lms.ai.api.create_goal', {
		title: goal.value?.title || undefined,
		outcome: goal.value?.outcome || undefined,
	})
		.then(async (name: string) => {
			justCreated = name
			if (goal.value) goal.value.name = name
			await router.replace({ name: 'GoalBuilder', params: { goal: name } })
			return name
		})
		.catch((error: any) => {
			// The next action tries again instead of waiting on this failure forever.
			creating = null
			toast.error(
				error?.messages?.[0] || __('Could not create the skill. Try again.')
			)
			throw error
		})
	return creating
}
provide('ensureGoal', ensureGoal)

const load = async () => {
	if (goalName.value && goalName.value === justCreated) {
		justCreated = null
		return
	}
	if (isNew.value) {
		goal.value = normalise({
			name: '',
			title: '',
			outcome: String(route.query.outcome || ''),
			status: 'Draft',
			activities: [],
			sources: [],
			documents: [],
			source_files: '{}',
			audience: [],
			learners: 0,
		})
		return
	}
	let fetched: Record<string, any>
	try {
		fetched = await call('lms.lms.ai.api.get_goal', { goal: goalName.value })
	} catch (error: any) {
		loadError.value =
			error?.messages?.[0] || __('Could not load this skill. Try again.')
		if (timer) clearInterval(timer)
		timer = null
		return
	}
	loadError.value = ''
	const data = normalise(fetched)
	if (data.title === UNTITLED) data.title = ''
	goal.value = data
}

const reading = computed(() =>
	(goal.value?.sources || []).some(
		(source: { status: string }) => source.status === 'Reading'
	)
)

const save = async (withActivities = false) => {
	if (!goal.value) return
	if (isNew.value) {
		if (!goal.value.title?.trim() && !goal.value.outcome?.trim()) return
		// Created with what was typed first; what was typed since is saved below.
		await ensureGoal()
	}
	saving.value = true
	const values: Record<string, any> = {
		title: goal.value.title,
		outcome: goal.value.outcome,
		due_date: goal.value.due_date || null,
		recurrence: goal.value.recurrence,
		mastery_threshold: goal.value.mastery_threshold,
		check_questions: goal.value.check_questions,
		acknowledgement_text: goal.value.acknowledgement_text,
		audience: (goal.value.audience || []).map(
			(row: { user: string }) => row.user
		),
	}
	for (const field of CHECKS) values[field] = goal.value[field] ? 1 : 0
	if (withActivities) values.activities = goal.value.activities
	try {
		const fresh = normalise(
			await call('lms.lms.ai.api.save_goal', { goal: goalName.value, values })
		)
		goal.value.minutes = fresh.minutes
		goal.value.status = fresh.status
	} finally {
		saving.value = false
	}
}

const move = (index: number, step: number) => {
	const list = goal.value!.activities
	const [item] = list.splice(index, 1)
	list.splice(index + step, 0, item)
	save(true)
}

const remove = (index: number) => {
	goal.value!.activities.splice(index, 1)
	save(true)
}

// One activity reworked by asking: follow its session until the activity is saved.
const revisions = ref<Record<string, 'running'>>({})
const revisionErrors = ref<Record<string, string | null>>({})
const polls = new Set<ReturnType<typeof setInterval>>()
const revise = async (row: string, index: number, request: string) => {
	revisionErrors.value[row] = null
	try {
		const session = await call('lms.lms.ai.api.revise_activity', {
			goal: goalName.value,
			index,
			request,
		})
		revisions.value[row] = 'running'
		const poll = setInterval(async () => {
			const result = await call('lms.lms.ai.api.revision_state', {
				session,
			}).catch(() => null)
			if (!result || result.running) return
			clearInterval(poll)
			polls.delete(poll)
			delete revisions.value[row]
			revisionErrors.value[row] = result.error
			if (!result.error) await load()
		}, 2500)
		polls.add(poll)
	} catch (err) {
		revisionErrors.value[row] = (err as Error).message
	}
}

const hasMaterial = computed(() =>
	(goal.value?.sources || []).some((source) => source.status === 'Completed')
)
const hasOutcome = computed(() => !!goal.value?.outcome?.trim())
const canBuild = computed(
	() => !reading.value && (hasMaterial.value || hasOutcome.value)
)
const draft = createResource({
	url: 'lms.lms.ai.api.draft_plan',
	onSuccess: load,
})
// The outcome saves on blur, which can still be in flight when Build is pressed.
const build = async () => {
	await save()
	draft.submit({ goal: await ensureGoal() })
}

const publish = createResource({
	url: 'lms.lms.ai.api.publish_goal',
	onSuccess(count: number) {
		const firstTime = goal.value?.status !== 'Published'
		toast.success(
			count
				? __(
						'Published and sent to {0} people. You can follow their progress in Readiness.'
				  ).format(count)
				: firstTime
				? __(
						"Published. Choose who it's for below whenever you want to send it to people."
				  )
				: __('Everyone you chose already has it.')
		)
		load()
	},
	onError: (err: Error) => toast.error(err.message),
})

const deleteSkill = createResource({
	url: 'lms.lms.ai.api.delete_goal',
	onSuccess() {
		toast.success(__('Skill deleted'))
		router.replace({ name: 'Goals' })
	},
	onError(error: any) {
		toast.error(
			error?.messages?.[0] || __('Could not delete the skill. Try again.')
		)
	},
})

// The dialog says what goes with the skill: for a published one, its people's progress.
const confirmDelete = () => {
	const learners = goal.value?.learners || 0
	createDialog({
		title: __('Delete {0}?').format(goal.value?.title || __('this skill')),
		message:
			learners === 1
				? __(
						'One person has this skill. Their progress goes with it. This cannot be undone.'
				  )
				: learners
				? __(
						'{0} people have this skill. Their progress goes with it. This cannot be undone.'
				  ).format(learners)
				: __('Its plan and material go with it. This cannot be undone.'),
		actions: [
			{
				label: __('Delete'),
				theme: 'red',
				variant: 'solid',
				onClick({ close }: { close: () => void }) {
					close()
					deleteSkill.submit({ goal: goalName.value })
				},
			},
		],
	})
}

const goalOptions = computed(() => [
	{ label: __('Delete'), icon: 'lucide-trash-2', onClick: confirmDelete },
])

const preview = createResource({
	url: 'lms.lms.ai.api.try_as_learner',
	onSuccess: () =>
		router.push({
			name: 'GoalSession',
			params: { goal: props.goal },
			query: { preview: '1' },
		}),
})

// The drafter saves through a tool in the flow server's callback, and material is read in a
// background job, so poll while either works: get_goal also notices a run that ended without saving.
let timer: ReturnType<typeof setInterval> | null = null
watch(
	() => goal.value?.status === 'Drafting' || reading.value,
	(busy) => {
		if (busy && !timer) timer = setInterval(load, 3000)
		if (!busy && timer) {
			clearInterval(timer)
			timer = null
		}
	}
)

const onDrafted = (data: { goal: string }) => {
	if (data?.goal === goalName.value) load()
}
socket?.on('lms_goal_drafted', onDrafted)
socket?.on('lms_goal_material', onDrafted)
onBeforeUnmount(() => {
	polls.forEach(clearInterval)
	socket?.off('lms_goal_drafted', onDrafted)
	socket?.off('lms_goal_material', onDrafted)
	if (timer) clearInterval(timer)
})

watch(goalName, load, { immediate: true })

const breadcrumbs = computed(() => [
	{ label: __('Skills'), route: { name: 'Goals' } },
	...(loadError.value
		? []
		: [
				{
					label: goal.value ? goal.value.title || __('New skill') : '',
					route: { name: 'GoalBuilder', params: { goal: goalName.value } },
				},
		  ]),
])

usePageMeta(() => ({ title: goal.value?.title || __('New skill') }))
</script>

<style scoped>
/* The course tabs' frame (TabbedDetailPage): one header-height row, panels that fill. */
.skill-tabs {
	display: flex;
	flex: 1 1 0%;
	flex-direction: column;
	min-height: 0;
}

.skill-tabs :deep([role='tablist']) {
	flex-shrink: 0;
	height: var(--header-frame-h);
	padding-inline: 1.25rem;
}

.skill-tabs :deep([role='tabpanel'][data-state='active']) {
	display: flex;
	flex: 1 1 0%;
	flex-direction: column;
	min-height: 0;
}
</style>
