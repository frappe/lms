<template>
	<div class="flex flex-col gap-4">
		<div v-if="stage !== 'result'" class="flex min-h-0 flex-1 flex-col">
			<div
				class="flex flex-wrap items-center gap-3 border-b border-outline-gray-1 px-4 py-3 sm:px-6"
			>
				<span class="relative shrink-0">
					<CharacterAvatar
						v-if="isCastKey(content.cast)"
						:who="content.cast"
						:label="content.character"
						class="size-8"
					/>
					<Avatar v-else :label="content.character" size="lg" />
					<span
						class="absolute -bottom-0.5 -end-0.5 size-2.5 rounded-full border-2 border-outline-base bg-surface-green-5"
						aria-hidden="true"
					/>
				</span>
				<div class="min-w-0 flex-1">
					<div class="truncate text-p-base font-semibold text-ink-gray-9">
						{{ content.character }}
					</div>
					<div class="truncate text-p-xs text-ink-gray-6">
						{{
							[
								content.character_role,
								__('role-play'),
								stage === 'chat'
									? __('{0} of {1} replies', [turns, exchanges])
									: stepLabel,
							]
								.filter(Boolean)
								.join(' · ')
						}}
					</div>
				</div>
				<Button
					v-if="stage === 'chat' && !outOfReplies"
					:disabled="turns < MIN_REPLIES"
					:loading="finishing"
					:title="
						turns < MIN_REPLIES ? __('Reply at least twice first') : undefined
					"
					:label="__('I\'m done')"
					@click="finish"
				/>
			</div>
			<div class="flex min-h-0 flex-1">
				<div
					v-if="stage === 'brief'"
					class="flex min-w-0 flex-1 flex-col overflow-y-auto"
				>
					<div
						class="mx-auto flex w-full max-w-[820px] flex-col gap-5 px-4 py-5 sm:px-6"
					>
						<div class="flex items-center gap-3">
							<CharacterAvatar
								v-if="isCastKey(content.cast)"
								:who="content.cast"
								:label="content.character"
								class="size-14 shrink-0"
							/>
							<Avatar v-else :label="content.character" size="xl" />
							<div class="min-w-0">
								<div class="text-p-base font-semibold text-ink-gray-9">
									{{ content.character }}
								</div>
								<div class="text-p-sm text-ink-gray-6">
									{{ content.character_role }}
								</div>
							</div>
						</div>
						<p v-if="content.setting" class="text-p-base text-ink-gray-8">
							{{ content.setting }}
						</p>
						<!-- On wide screens the side panel shows these, as it does during the chat. -->
						<div v-if="content.learner_task" class="lg:hidden">
							<div class="text-p-xs text-ink-gray-6">{{ __('Your task') }}</div>
							<p class="mt-1 text-p-sm text-ink-gray-8">
								{{ content.learner_task }}
							</p>
						</div>
						<div v-if="content.criteria?.length" class="lg:hidden">
							<div class="text-p-xs text-ink-gray-6">
								{{ __('What counts') }}
							</div>
							<ul class="mt-1.5 space-y-1.5">
								<li
									v-for="criterion in content.criteria"
									:key="criterion"
									class="text-p-sm text-ink-gray-8"
								>
									{{ criterion }}
								</li>
							</ul>
						</div>
						<div
							class="flex flex-col gap-4 border-t border-outline-gray-1 pt-5 sm:flex-row sm:items-center"
						>
							<p class="flex-1 text-p-sm text-ink-gray-6">
								{{
									__(
										'Reply in your own words, the way you would for real. You get {0} replies, and can press "I\'m done" after your second.',
										[exchanges]
									)
								}}
							</p>
							<Button
								variant="solid"
								class="self-end sm:self-auto"
								:loading="starting"
								@click="start"
							>
								<template #prefix
									><span class="lucide-messages-square size-4"
								/></template>
								{{ __('Start the conversation') }}
							</Button>
						</div>
					</div>
				</div>
				<div v-else class="flex min-w-0 flex-1 flex-col">
					<FlowChat
						:session="session"
						:assistant-name="content.character"
						:character="isCastKey(content.cast) ? content.cast : undefined"
						:placeholder="__('Reply to {0}').format(content.character)"
						hide-first-message
						voice
						:read-only="outOfReplies"
						run-method="lms.lms.ai.api.roleplay_reply"
						@messages="(count) => (turns = count)"
					>
						<template v-if="sceneLine" #before>
							<p class="pb-3 text-center text-p-xs text-ink-gray-6">
								{{ sceneLine }}
							</p>
						</template>
					</FlowChat>
					<div
						v-if="outOfReplies"
						class="mx-auto w-full max-w-[820px] px-4 pb-4 sm:px-6 sm:pb-5"
					>
						<div
							class="flex flex-wrap items-center justify-between gap-3 rounded-7 border border-outline-gray-2 bg-surface-gray-1 px-4 py-3"
						>
							<span class="text-p-sm text-ink-gray-7">
								{{
									__(
										"That's all your replies. See how you did with {0}."
									).format(content.character)
								}}
							</span>
							<Button
								variant="solid"
								:loading="finishing"
								:label="__('See how I did')"
								@click="finish"
							/>
						</div>
					</div>
				</div>
				<aside
					:aria-label="__('About this role-play')"
					class="hidden w-80 shrink-0 flex-col gap-5 overflow-y-auto border-s border-outline-gray-1 px-5 py-6 lg:flex"
				>
					<div class="flex flex-col items-center gap-1.5 text-center">
						<CharacterAvatar
							v-if="isCastKey(content.cast)"
							:who="content.cast"
							:label="content.character"
							class="size-16"
						/>
						<Avatar v-else :label="content.character" size="3xl" />
						<div class="text-p-base font-semibold text-ink-gray-9">
							{{ content.character }}
						</div>
						<p v-if="content.personality" class="text-p-sm text-ink-gray-6">
							{{ content.personality }}
						</p>
					</div>
					<div v-if="youAre">
						<div class="text-p-xs text-ink-gray-6">{{ __('You are') }}</div>
						<p class="mt-1 text-p-sm text-ink-gray-8">{{ youAre }}</p>
					</div>
					<div v-if="content.learner_task">
						<div class="text-p-xs text-ink-gray-6">{{ __('Your task') }}</div>
						<p class="mt-1 text-p-sm text-ink-gray-8">
							{{ content.learner_task }}
						</p>
					</div>
					<div v-if="content.criteria?.length">
						<div class="text-p-xs text-ink-gray-6">{{ __('What counts') }}</div>
						<ul class="mt-1.5 space-y-1.5">
							<li
								v-for="criterion in content.criteria"
								:key="criterion"
								class="text-p-sm text-ink-gray-8"
							>
								{{ criterion }}
							</li>
						</ul>
					</div>
				</aside>
			</div>
		</div>

		<div
			v-else
			class="rounded-7 border border-outline-gray-2 bg-surface-base p-5"
		>
			<div v-if="evidence?.status === 'Graded'">
				<div class="flex items-center gap-4">
					<div
						class="flex size-14 shrink-0 items-center justify-center rounded-full text-lg-semibold"
						:class="
							evidence.passed
								? 'bg-surface-green-1 text-ink-green-7'
								: 'bg-surface-amber-1 text-ink-amber-7'
						"
					>
						{{ evidence.score }}%
					</div>
					<div class="min-w-0">
						<div class="text-lg-semibold text-ink-gray-9">
							{{
								evidence.passed
									? __('Nicely handled')
									: __('Good practice, one more go?')
							}}
						</div>
						<div class="mt-0.5 text-p-sm text-ink-gray-6">
							{{
								evidence.passed
									? __(
											'You scored {0}%. The passing percentage is {1}%.'
									  ).format(evidence.score, passMark)
									: __(
											'You scored {0}%. The passing percentage is {1}%. Try once more with the tip below.'
									  ).format(evidence.score, passMark)
							}}
						</div>
					</div>
				</div>

				<div
					v-if="feedbackParts.well || feedbackParts.next"
					class="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2"
				>
					<div
						v-if="feedbackParts.well"
						class="rounded-5 bg-surface-gray-1 p-3"
					>
						<div
							class="mb-1 flex items-center gap-1.5 text-p-sm-medium text-ink-gray-9"
						>
							<span class="lucide-circle-check size-4 text-ink-green-6" />
							{{ __('What went well') }}
						</div>
						<p class="text-p-sm text-ink-gray-7">{{ feedbackParts.well }}</p>
					</div>
					<div
						v-if="feedbackParts.next"
						class="rounded-5 bg-surface-gray-1 p-3"
					>
						<div
							class="mb-1 flex items-center gap-1.5 text-p-sm-medium text-ink-gray-9"
						>
							<span class="lucide-lightbulb size-4 text-ink-amber-6" />
							{{ __('Try next time') }}
						</div>
						<p class="text-p-sm text-ink-gray-7">{{ feedbackParts.next }}</p>
					</div>
				</div>

				<div v-if="evidence.criteria?.length" class="mt-5">
					<div class="mb-2 flex items-center justify-between">
						<span class="text-p-sm-medium text-ink-gray-9">{{
							__('How you did')
						}}</span>
						<Button
							v-if="evidence.criteria.some((row: any) => row.evidence)"
							variant="ghost"
							size="sm"
							@click="showQuotes = !showQuotes"
						>
							<template #suffix>
								<span
									class="size-3.5"
									:class="
										showQuotes ? 'lucide-chevron-up' : 'lucide-chevron-down'
									"
								/>
							</template>
							{{
								showQuotes ? __('Hide what you said') : __('Show what you said')
							}}
						</Button>
					</div>
					<ul class="divide-y divide-outline-gray-1">
						<li
							v-for="row in evidence.criteria"
							:key="row.criterion"
							class="py-2.5"
						>
							<div class="flex items-center gap-4 text-p-sm">
								<span class="min-w-0 flex-1 text-ink-gray-8">{{
									row.criterion
								}}</span>
								<Progress :value="row.score" size="sm" class="w-28 sm:w-40" />
								<span
									class="w-10 text-end"
									:class="
										row.score >= passMark
											? 'text-ink-gray-6'
											: 'text-ink-amber-7'
									"
									>{{ row.score }}%</span
								>
							</div>
							<p
								v-if="showQuotes && row.evidence"
								class="mt-1 text-p-xs text-ink-gray-6"
							>
								{{ __('You said: {0}').format(plainQuote(row.evidence)) }}
							</p>
						</li>
					</ul>
				</div>

				<div class="mt-5 flex flex-wrap items-center justify-end gap-2">
					<Button @click="restart">{{ __('Try again') }}</Button>
					<Button variant="solid" @click="emit('next')">{{
						__('Continue')
					}}</Button>
				</div>
			</div>
			<div v-else class="flex flex-col gap-5" role="status" aria-live="polite">
				<div class="flex items-center gap-4">
					<CharacterAvatar
						v-if="isCastKey(content.cast)"
						:who="content.cast"
						:label="content.character"
						class="size-14 shrink-0"
					/>
					<div class="min-w-0">
						<div
							class="flex items-center gap-2 text-lg-semibold text-ink-gray-9"
						>
							<LoadingIndicator class="size-4 text-ink-gray-6" />
							{{ __('Looking at how it went') }}
						</div>
						<div class="mt-0.5 text-p-sm text-ink-gray-6">
							{{
								__(
									'Reading your conversation with {0}. This takes about half a minute.'
								).format(content.character)
							}}
						</div>
					</div>
				</div>
				<!-- The shape of the result, so the wait shows what is coming. -->
				<div class="grid grid-cols-1 gap-3 sm:grid-cols-2" aria-hidden="true">
					<div class="h-20 animate-pulse rounded-5 bg-surface-gray-1" />
					<div class="h-20 animate-pulse rounded-5 bg-surface-gray-1" />
				</div>
				<ul class="space-y-3" aria-hidden="true">
					<li
						v-for="criterion in content.criteria || []"
						:key="criterion"
						class="flex items-center gap-4 text-p-sm text-ink-gray-6"
					>
						<span class="min-w-0 flex-1">{{ criterion }}</span>
						<span
							class="h-1.5 w-28 animate-pulse rounded-full bg-surface-gray-2 sm:w-40"
						/>
					</li>
				</ul>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, inject, onBeforeUnmount, ref, watch } from 'vue'
import {
	Avatar,
	Button,
	call,
	LoadingIndicator,
	Progress,
	toast,
} from 'frappe-ui'
import type { Socket } from 'socket.io-client'
import FlowChat from '@/components/Goals/FlowChat.vue'
import CharacterAvatar from '@/components/Goals/CharacterAvatar.vue'
import { isCastKey } from '@/utils/characters'

const props = withDefaults(
	defineProps<{
		activity: Record<string, any>
		assignment: string
		/** "step 2 of 4", for the header strip before the chat starts. */
		stepLabel?: string
	}>(),
	{ stepLabel: '' }
)
const emit = defineEmits<{ next: []; refresh: []; live: [live: boolean] }>()
const socket = inject<Socket>('$socket')

const content = computed(() => props.activity.content)
const evidence = computed(() => props.activity.evidence)
const session = ref<string | null>(null)
const stage = ref<'brief' | 'chat' | 'result'>('brief')
const turns = ref(0)
const starting = ref(false)
const finishing = ref(false)

// The learner's replies. FlowChat leaves the hidden brief out of its count.
const MIN_REPLIES = 2
const exchanges = computed(() => Number(content.value.exchanges) || 4)
const outOfReplies = computed(() => turns.value >= exchanges.value)
const showQuotes = ref(false)

const passMark = computed(() => props.activity.content?.pass_mark || 70)

/** The grader writes what went well first, then what to change. */
const feedbackParts = computed(() => {
	const sentences = (evidence.value?.feedback || '')
		.trim()
		.split(/(?<=[.!?])\s+/)
		.filter(Boolean)
	return { well: sentences[0] || '', next: sentences.slice(1).join(' ') }
})

/** Grades written before the grader dropped its own quotation marks still carry them. */
const plainQuote = (text: string) =>
	`"${text.trim().replace(/^["“]+|["”]+$/g, '')}"`

// The brief and the conversation share one full-width page, so starting doesn't jump.
watch(
	() => stage.value !== 'result',
	(live) => emit('live', live),
	{ immediate: true }
)

// The setting opens with where they are; it can go on to say who the learner is.
const sceneLine = computed(() => {
	const setting = (content.value.setting || '').trim()
	return setting.split(/(?<=[.!?])\s+/)[0] || ''
})
const youAre = computed(() => {
	const rest = (content.value.setting || '')
		.trim()
		.split(/(?<=[.!?])\s+/)
		.slice(1)
		.join(' ')
	const match = rest.match(/^You are (.+)$/i)
	return match ? match[1].charAt(0).toUpperCase() + match[1].slice(1) : ''
})

const sync = () => {
	const ev = evidence.value
	if (ev?.status === 'Graded' || ev?.status === 'Grading')
		stage.value = 'result'
	else if (ev?.flow_session) {
		session.value = ev.flow_session
		stage.value = 'chat'
	} else stage.value = 'brief'
}
watch(() => [props.activity.index, evidence.value?.status], sync, {
	immediate: true,
})

const start = async () => {
	starting.value = true
	try {
		session.value = await call('lms.lms.ai.api.start_roleplay', {
			assignment: props.assignment,
			index: props.activity.index,
		})
		turns.value = 0
		stage.value = 'chat'
	} catch (err) {
		toast.error((err as Error).message)
	} finally {
		starting.value = false
	}
}

const restart = () => {
	session.value = null
	start()
}

const finish = async () => {
	finishing.value = true
	try {
		await call('lms.lms.ai.api.finish_roleplay', {
			assignment: props.assignment,
			index: props.activity.index,
		})
		stage.value = 'result'
		emit('refresh')
	} catch (err) {
		toast.error((err as Error).message)
	} finally {
		finishing.value = false
	}
}

// The grade arrives from the flow server's callback, so wait for it here.
let timer: ReturnType<typeof setInterval> | null = null
watch(
	() => stage.value === 'result' && evidence.value?.status !== 'Graded',
	(waiting) => {
		if (waiting && !timer) timer = setInterval(() => emit('refresh'), 4000)
		if (!waiting && timer) {
			clearInterval(timer)
			timer = null
		}
	},
	{ immediate: true }
)

const onGraded = (data: { assignment: string }) => {
	if (data?.assignment === props.assignment) emit('refresh')
}
socket?.on('lms_goal_evidence_graded', onGraded)
onBeforeUnmount(() => {
	socket?.off('lms_goal_evidence_graded', onGraded)
	if (timer) clearInterval(timer)
})
</script>
