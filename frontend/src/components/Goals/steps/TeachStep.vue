<template>
	<div class="flex min-h-0 flex-1 flex-col">
		<div
			class="flex flex-wrap items-center gap-3 border-b border-outline-gray-1 px-4 py-3 sm:px-6"
		>
			<span class="relative shrink-0">
				<CharacterAvatar who="lumi" class="size-8" />
				<span
					class="absolute -bottom-0.5 -end-0.5 size-2.5 rounded-full border-2 border-outline-base bg-surface-green-5"
					aria-hidden="true"
				/>
			</span>
			<div class="min-w-0 flex-1">
				<!-- On a phone the step picker above already names the step, so only
				     who is teaching stays here. -->
				<div
					class="hidden truncate text-p-base font-semibold text-ink-gray-9 md:block"
				>
					{{ activity.title }}
				</div>
				<div class="truncate text-p-xs text-ink-gray-6">
					{{ __('Lesson with {0}', [TUTOR_NAME]) }}
					<template v-if="stepLabel"
						><span class="hidden md:inline"> · {{ stepLabel }}</span></template
					>
				</div>
			</div>
			<!-- Key ideas stay one glance away: a small progress strip that opens
			     into the list, instead of a column that takes the exercise's room. -->
			<button
				v-if="ideas.length"
				type="button"
				class="flex items-center gap-2 rounded-4 border border-outline-gray-2 px-2.5 py-1.5 text-p-xs text-ink-gray-8 hover:bg-surface-gray-1"
				:aria-expanded="showIdeas"
				@click="showIdeas = !showIdeas"
			>
				<span class="flex gap-0.5" aria-hidden="true">
					<span
						v-for="idea in ideas"
						:key="idea.idea"
						class="h-1 w-3.5 rounded-full"
						:class="idea.confirmed ? 'bg-surface-green-5' : 'bg-surface-gray-3'"
					/>
				</span>
				<span class="hidden sm:inline">{{
					__('{0} of {1} key ideas').format(confirmed, ideas.length)
				}}</span>
				<span class="sm:hidden">{{ `${confirmed}/${ideas.length}` }}</span>
				<span
					class="size-3.5"
					:class="showIdeas ? 'lucide-chevron-up' : 'lucide-chevron-down'"
					aria-hidden="true"
				/>
			</button>
		</div>
		<KeyIdeas
			v-if="showIdeas"
			:ideas="ideas"
			class="border-b border-outline-gray-1 px-4 py-3 sm:px-6"
		/>
		<div v-if="!session" class="flex-1 overflow-y-auto">
			<div
				class="mx-auto flex w-full max-w-[820px] flex-col items-center px-4 py-10 text-center sm:px-6 sm:py-16"
			>
				<CharacterAvatar who="lumi" mood="happy" class="size-24 sm:size-28" />
				<h2 class="mt-4 text-lg-semibold text-ink-gray-9">
					{{ __("Hi, I'm {0}").format(TUTOR_NAME) }}
				</h2>
				<p class="mt-2 max-w-md text-p-base text-ink-gray-7">
					{{
						__(
							"I'll be your tutor for this session. We'll start from what you already know and spend our time on what's new to you. Nothing here is graded, so think out loud."
						)
					}}
				</p>
				<template v-if="canListen">
					<p class="mt-6 text-p-sm text-ink-gray-7">
						{{ __('How would you like to talk?') }}
					</p>
					<div
						class="mt-2 grid w-full max-w-sm grid-cols-2 gap-2"
						role="radiogroup"
						:aria-label="__('How would you like to talk?')"
					>
						<button
							v-for="option in modes"
							:key="option.value"
							type="button"
							role="radio"
							:aria-checked="mode === option.value"
							class="flex flex-col items-center gap-1.5 rounded-7 border p-3 text-p-sm transition-colors"
							:class="
								mode === option.value
									? 'border-outline-gray-5 bg-surface-gray-1 text-ink-gray-9'
									: 'border-outline-gray-2 text-ink-gray-7 hover:border-outline-gray-3'
							"
							@click="mode = option.value"
						>
							<span class="size-5" :class="option.icon" />
							{{ option.label }}
						</button>
					</div>
					<p class="mt-2 text-p-xs text-ink-gray-6">
						{{ __('You can switch any time while you talk.') }}
					</p>
				</template>
				<Button class="mt-6" variant="solid" :loading="starting" @click="start">
					<template #prefix><span class="lucide-sparkles size-4" /></template>
					{{ __('Start learning with {0}').format(TUTOR_NAME) }}
				</Button>
			</div>
		</div>
		<template v-else>
			<FlowChat
				:session="session"
				:assistant-name="TUTOR_NAME"
				character="lumi"
				:placeholder="__('Reply to {0}').format(TUTOR_NAME)"
				:tool-labels="toolLabels()"
				hide-first-message
				voice
				:message-actions="['simpler', 'replay', 'source']"
				:quick-replies="quickReplies"
				:commands="commands"
				:waiting-text="__('{0} is reading your answer', [TUTOR_NAME])"
				:done="ready"
				@messages="emit('refresh')"
				@moment="recordMoment"
			>
				<template #done>
					<div class="-mx-2 flex gap-3 px-2 py-2">
						<CharacterAvatar
							who="lumi"
							mood="happy"
							:label="TUTOR_NAME"
							class="size-8 shrink-0"
						/>
						<div class="min-w-0 flex-1">
							<div class="text-p-sm font-semibold text-ink-gray-9">
								{{ TUTOR_NAME }}
							</div>
							<div
								class="mt-1.5 flex max-w-[560px] flex-col gap-3 rounded-7 border border-outline-green-2 bg-surface-green-1 px-4 py-3"
							>
								<div class="text-p-sm text-ink-gray-8">
									<span class="text-base-medium text-ink-gray-9">{{
										__("You're ready to practise.")
									}}</span>
									{{ __('Next, try it out in a real situation.') }}
								</div>
								<Button
									variant="solid"
									class="self-start"
									:label="__('Start practising')"
									@click="emit('next')"
								/>
							</div>
						</div>
					</div>
				</template>
			</FlowChat>
		</template>
	</div>
</template>

<script setup lang="ts">
import { computed, inject, onBeforeUnmount, ref, watch } from 'vue'
import { Button, call, toast } from 'frappe-ui'
import type { Socket } from 'socket.io-client'
import FlowChat from '@/components/Goals/FlowChat.vue'
import CharacterAvatar from '@/components/Goals/CharacterAvatar.vue'
import KeyIdeas, { type KeyIdea } from '@/components/Goals/KeyIdeas.vue'
import {
	preferredMode,
	rememberMode,
	useVoice,
	type VoiceMode,
} from '@/composables/useVoice'
import { TUTOR_NAME } from '@/utils/characters'
import { toolLabels } from '@/utils/goals'

const props = withDefaults(
	defineProps<{
		activity: Record<string, any>
		assignment: string
		ideas?: KeyIdea[]
		/** "Step 2 of 4", for the header strip. */
		stepLabel?: string
	}>(),
	{ ideas: () => [], stepLabel: '' }
)
const emit = defineEmits<{ next: []; refresh: []; live: [live: boolean] }>()
const socket = inject<Socket>('$socket')

const { canListen } = useVoice()
const mode = ref<VoiceMode>(preferredMode() || 'speak')
const modes = [
	{ value: 'speak' as const, label: __('Speak'), icon: 'lucide-mic' },
	{ value: 'type' as const, label: __('Type'), icon: 'lucide-keyboard' },
]

const starting = ref(false)
const showIdeas = ref(false)
const session = ref<string | null>(
	props.activity.evidence?.flow_session || null
)
const ready = computed(() => props.activity.evidence?.status === 'Graded')
const confirmed = computed(
	() => props.ideas.filter((idea) => idea.confirmed).length
)

// The intro and the conversation share one full-width page, so starting doesn't jump.
emit('live', true)

const quickReplies = [
	__("I'm not sure"),
	__('Give me an example'),
	__("Let's practise"),
]
const commands = [
	{
		name: 'explain',
		label: __('Explain it another way'),
		message: __('Can you explain that another way?'),
	},
	{
		name: 'hint',
		label: __('Give me a hint'),
		message: __('Can I have a hint?'),
	},
	{
		name: 'example',
		label: __('Show a real example'),
		message: __('Can you show me a real example?'),
	},
	{
		name: 'skip',
		label: __('I know this, move on'),
		message: __('I already know this one. Can we move on?'),
	},
]

watch(
	() => props.activity.evidence?.flow_session,
	(value) => {
		if (value) session.value = value
	}
)

const start = async () => {
	if (canListen) rememberMode(mode.value)
	starting.value = true
	try {
		session.value = await call('lms.lms.ai.api.start_teaching', {
			assignment: props.assignment,
			index: props.activity.index,
		})
		emit('refresh')
	} catch (err) {
		toast.error((err as Error).message)
	} finally {
		starting.value = false
	}
}

// A missed moment counts against its idea, so the final check can come back to it.
const recordMoment = (payload: Record<string, unknown>) => {
	call('lms.lms.ai.api.record_moment', {
		assignment: props.assignment,
		idea: payload.idea ?? null,
		correct: Boolean(payload.correct),
		confidence: (payload.confidence as string) || null,
	}).catch(() => null)
}

const onIdeas = (data: { assignment: string }) => {
	if (data?.assignment === props.assignment) emit('refresh')
}
socket?.on('lms_goal_ideas', onIdeas)
onBeforeUnmount(() => socket?.off('lms_goal_ideas', onIdeas))
</script>
