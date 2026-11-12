<template>
	<div class="flex min-h-0 flex-1 flex-col">
		<VoiceStage
			v-if="mode === 'speak'"
			:character="character || 'lumi'"
			:assistant-name="assistantName"
			:caption="speech.caption.value"
			:speaking="speech.speaking.value"
			:running="running"
			:thinking-label="toolLabel"
			:moment="shownMoment"
			:result="shownMoment ? results[shownMoment.id] : undefined"
			@answer="answerMoment"
		/>
		<div v-else ref="scroller" class="flex-1 overflow-y-auto">
			<div
				class="mx-auto flex w-full max-w-[820px] flex-col gap-1 px-4 py-5 sm:px-6"
			>
				<slot name="before" />
				<div v-if="loading && !messages.length" class="space-y-3">
					<div class="h-4 w-2/3 animate-pulse rounded-4 bg-surface-gray-2" />
					<div class="h-4 w-1/2 animate-pulse rounded-4 bg-surface-gray-2" />
				</div>
				<div
					v-else-if="!messages.length && !partial && !running && emptyText"
					class="-mx-2 flex gap-3 px-2 py-2"
				>
					<CharacterAvatar
						v-if="character"
						:who="character"
						mood="happy"
						:label="assistantName"
						class="size-8 shrink-0"
					/>
					<Avatar v-else :label="assistantName" size="lg" class="shrink-0" />
					<div class="min-w-0 flex-1">
						<div class="text-p-sm font-semibold text-ink-gray-9">
							{{ assistantName }}
						</div>
						<p class="mt-0.5 text-p-base text-ink-gray-8">{{ emptyText }}</p>
					</div>
				</div>
				<div
					v-for="message in messages"
					:key="message.key"
					class="group relative -mx-2 flex gap-3 rounded-6 px-2 py-2 transition-colors hover:bg-surface-gray-1"
				>
					<template v-if="message.role === 'assistant'">
						<CharacterAvatar
							v-if="character"
							:who="character"
							:mood="message.moments.length ? 'curious' : 'calm'"
							:label="assistantName"
							class="size-8 shrink-0"
						/>
						<Avatar v-else :label="assistantName" size="lg" class="shrink-0" />
					</template>
					<Avatar
						v-else
						:label="userName"
						:image="userImage"
						size="lg"
						class="shrink-0"
					/>
					<div class="flex min-w-0 flex-1 flex-col gap-2.5">
						<div class="min-w-0">
							<div class="flex items-baseline gap-2">
								<span class="text-p-sm font-semibold text-ink-gray-9">{{
									message.role === 'assistant' ? assistantName : __('You')
								}}</span>
								<time
									v-if="message.ts"
									class="text-p-xs text-ink-gray-6"
									:datetime="dayjs.unix(message.ts).toISOString()"
									>{{ dayjs.unix(message.ts).format('LT') }}</time
								>
							</div>
							<div
								v-if="message.text && message.role === 'assistant'"
								class="prose prose-sm max-w-none text-p-base text-ink-gray-8 prose-p:my-1 prose-ul:my-1"
								v-safe-html:rich="render(message.text)"
							/>
							<p
								v-else-if="message.text"
								class="mt-0.5 whitespace-pre-wrap text-p-base text-ink-gray-8"
							>
								{{ message.text }}
							</p>
						</div>
						<MomentBlock
							v-for="item in message.moments"
							:key="item.id"
							:id="item.id"
							:moment="item.moment"
							:result="results[item.id]"
							:active="item.id === currentMoment?.id"
							class="max-w-[560px]"
							@answer="answerMoment"
						/>
					</div>
					<div
						v-if="
							message.role === 'assistant' &&
							message.text &&
							(messageActions.includes('simpler') ||
								(voice && messageActions.includes('replay')) ||
								(messageActions.includes('source') && sourceOf(message)))
						"
						role="toolbar"
						:aria-label="__('Message actions')"
						class="absolute -top-3.5 end-3 flex gap-0.5 rounded-4 border border-outline-gray-2 bg-surface-base p-0.5 opacity-0 shadow-sm transition-opacity focus-within:opacity-100 group-hover:opacity-100"
					>
						<Button
							v-if="messageActions.includes('simpler')"
							variant="ghost"
							size="sm"
							:label="__('Say it simpler')"
							:disabled="running || disabled"
							@click="saySimpler(message)"
						/>
						<Button
							v-if="voice && messageActions.includes('replay')"
							variant="ghost"
							size="sm"
							icon="lucide-volume-2"
							:aria-label="__('Replay voice')"
							@click="replay(message)"
						/>
						<Button
							v-if="messageActions.includes('source') && sourceOf(message)"
							variant="ghost"
							size="sm"
							icon="lucide-book-open"
							:aria-label="__('Show source')"
							:href="safeUrl(sourceOf(message))"
						/>
					</div>
				</div>
				<div v-if="running && partial" class="-mx-2 flex gap-3 px-2 py-2">
					<CharacterAvatar
						v-if="character"
						:who="character"
						mood="think"
						:label="assistantName"
						class="size-8 shrink-0"
					/>
					<Avatar v-else :label="assistantName" size="lg" class="shrink-0" />
					<div class="min-w-0 flex-1">
						<div class="text-p-sm font-semibold text-ink-gray-9">
							{{ assistantName }}
						</div>
						<div
							class="prose prose-sm max-w-none text-p-base text-ink-gray-8 prose-p:my-1"
							v-safe-html:rich="render(partial)"
						/>
					</div>
				</div>
				<ErrorMessage v-if="error" :message="error" />
				<slot v-if="done && !running" name="done" />
			</div>
		</div>
		<CitationPreview :container="scroller" />
		<div
			v-if="!readOnly"
			class="mx-auto w-full max-w-[820px] px-4 pb-4 sm:px-6 sm:pb-5"
		>
			<div
				v-if="running && !partial && mode !== 'speak'"
				class="flex items-center gap-2 px-1 pb-2 text-p-xs text-ink-gray-6"
				role="status"
			>
				<span class="flex gap-1" aria-hidden="true">
					<span
						class="size-1.5 animate-bounce rounded-full bg-surface-gray-6"
					/>
					<span
						class="size-1.5 animate-bounce rounded-full bg-surface-gray-5 [animation-delay:150ms]"
					/>
					<span
						class="size-1.5 animate-bounce rounded-full bg-surface-gray-4 [animation-delay:300ms]"
					/>
				</span>
				{{ waitingLabel }}
			</div>
			<!-- An exercise is answered by tapping, so the mic and its controls step aside. -->
			<div
				v-if="mode === 'speak' && awaitingAnswer"
				class="flex items-center justify-center gap-2 rounded-7 border border-outline-gray-2 px-3 py-2.5 text-p-sm text-ink-gray-6"
			>
				<span class="lucide-pointer size-4" aria-hidden="true" />
				{{ __('Tap your answer. We carry on talking after.') }}
			</div>
			<template v-else>
				<div
					v-if="mode !== 'speak' && quickReplies.length && !running && !draft"
					class="flex flex-wrap gap-2 pb-2"
				>
					<Button
						v-for="reply in quickReplies"
						:key="reply"
						variant="outline"
						size="sm"
						:label="reply"
						:disabled="disabled"
						@click="send(reply)"
					/>
				</div>
				<div class="relative">
					<div
						v-if="commandMatches.length"
						role="listbox"
						:aria-label="__('Commands')"
						class="absolute inset-x-0 bottom-full z-10 mb-2 w-full max-w-sm rounded-7 border border-outline-gray-2 bg-surface-base p-1.5 shadow-xl"
					>
						<div class="px-2 py-1.5 text-p-xs text-ink-gray-6">
							{{ __('Ask {0} to', [assistantName]) }}
						</div>
						<button
							v-for="(command, i) in commandMatches"
							:key="command.name"
							type="button"
							role="option"
							:aria-selected="i === commandIndex"
							class="flex w-full items-center gap-3 rounded-4 px-2 py-2 text-start text-p-sm"
							:class="
								i === commandIndex
									? 'bg-surface-gray-2'
									: 'hover:bg-surface-gray-1'
							"
							@mousedown.prevent="runCommand(command)"
						>
							<span class="w-20 shrink-0 font-semibold text-ink-gray-9"
								>/{{ command.name }}</span
							>
							<span class="text-ink-gray-6">{{ command.label }}</span>
						</button>
					</div>
					<div
						class="flex flex-col gap-2 rounded-7 border border-outline-gray-3 bg-surface-base px-3 py-2.5 focus-within:border-outline-gray-4"
					>
						<div
							v-if="mode === 'speak'"
							class="flex flex-col items-center gap-2 py-1"
						>
							<Button
								size="lg"
								:variant="held ? 'solid' : 'subtle'"
								:theme="voiceTools.listening.value ? 'red' : 'gray'"
								:disabled="disabled"
								:aria-label="
									held ? __('Continue talking') : __('Pause the conversation')
								"
								@click="toggleListening"
							>
								<template #icon>
									<span
										class="size-6"
										:class="[
											held ? 'lucide-mic-off' : 'lucide-mic',
											voiceTools.listening.value ? 'animate-pulse' : '',
										]"
									/>
								</template>
							</Button>
							<!-- Their words appear here as they speak, and stay while the reply comes. -->
							<p
								class="min-h-5 max-w-md text-center text-p-sm"
								:class="heardWords ? 'text-ink-gray-8' : 'text-ink-gray-6'"
							>
								{{ micStatus }}
							</p>
							<ErrorMessage :message="voiceTools.error.value" />
						</div>
						<Textarea
							v-else
							v-model="draft"
							variant="ghost"
							class="resize-none"
							:rows="1"
							:placeholder="composerPlaceholder"
							:disabled="disabled"
							:aria-label="placeholder"
							@keydown="onComposerKey"
						/>
						<div class="flex items-center gap-2">
							<TabButtons
								v-if="voice && voiceTools.canListen"
								v-model="mode"
								:options="modes"
							/>
							<span class="flex-1" />
							<Button
								v-if="mode !== 'speak'"
								variant="solid"
								:disabled="disabled || !draft.trim() || running"
								:aria-label="__('Send')"
								icon="lucide-send"
								@click="submit"
							/>
						</div>
					</div>
				</div>
			</template>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, inject, nextTick, ref, toRef, watch } from 'vue'
import { Avatar, Button, ErrorMessage, TabButtons, Textarea } from 'frappe-ui'
// @ts-expect-error markdown-it ships no type declarations
import MarkdownIt from 'markdown-it'
import {
	MOMENT_RESULT,
	useFlowChat,
	type ChatMessage,
	type Moment,
} from '@/composables/useFlowChat'
import {
	preferredMode,
	rememberMode,
	setTranscribeSession,
	useVoice,
	type VoiceMode,
} from '@/composables/useVoice'
import { useSpeech } from '@/composables/useSpeech'
import dayjs from '@/utils/dayjs'
import MomentBlock from './moments/MomentBlock.vue'
import { safeUrl } from '@/utils/safeUrl'
import CharacterAvatar from './CharacterAvatar.vue'
import CitationPreview from './CitationPreview.vue'
import VoiceStage from './VoiceStage.vue'
import { type CharacterKey } from '@/utils/characters'

const props = withDefaults(
	defineProps<{
		session: string | null | undefined
		assistantName?: string
		placeholder?: string
		emptyText?: string
		hideFirstMessage?: boolean
		disabled?: boolean
		readOnly?: boolean
		toolLabels?: Record<string, string>
		voice?: boolean
		/** Lumi or a cast member: draws their face and speaks in their voice. */
		character?: CharacterKey
		/** Send replies through this method instead of the plain Flow run. */
		runMethod?: string
		/** The conversation reached its goal: the `done` slot shows as its last message. */
		done?: boolean
		/** Hover actions on the assistant's messages. Replay needs `voice`; source shows only for cited answers. */
		messageActions?: ('simpler' | 'replay' | 'source')[]
		/** One-tap replies offered above the composer. */
		quickReplies?: string[]
		/** Typing "/" offers these; picking one sends its message. */
		commands?: { name: string; label: string; message: string }[]
		/** What the wait reads while a reply is on its way. */
		waitingText?: string
	}>(),
	{
		assistantName: 'AI',
		placeholder: 'Type a message',
		emptyText: '',
		hideFirstMessage: false,
		disabled: false,
		readOnly: false,
		toolLabels: () => ({}),
		voice: false,
		done: false,
		messageActions: () => [],
		quickReplies: () => [],
		commands: () => [],
		waitingText: '',
		character: undefined,
		runMethod: undefined,
	}
)

const emit = defineEmits<{
	messages: [count: number]
	moment: [payload: Record<string, unknown>]
}>()

const markdown = new MarkdownIt({ linkify: true, breaks: true })
// A citation like [Policy · p.3] becomes a link that opens the document at that page.
const sourceLink = inject<((source: string) => string | null) | null>(
	'goalSourceLink',
	null
)
const render = (text: string): string => {
	const linked = sourceLink
		? (text || '').replace(
				/\[([^[\]]+? · p\.\d+(?:[-–]\d+)?(?:,\s*p\.\d+(?:[-–]\d+)?)*)\](?!\()/g,
				(match, source) => {
					const url = sourceLink(source)
					return url ? `[${source}](${url})` : match
				}
		  )
		: text || ''
	return markdown.render(linked)
}

const {
	messages,
	results,
	partial,
	activeTool,
	running,
	error,
	loading,
	send,
} = useFlowChat(toRef(props, 'session'), {
	hideFirstMessage: props.hideFirstMessage,
	runMethod: props.runMethod,
})

const draft = ref('')
const scroller = ref<HTMLElement | null>(null)

const user = inject<{ data?: { full_name?: string; user_image?: string } }>(
	'$user',
	{}
)
const userName = computed(() => user.data?.full_name || __('You'))
const userImage = computed(() => user.data?.user_image)

const waitingLabel = computed(() =>
	activeTool.value
		? toolLabel.value
		: props.waitingText || __('{0} is typing', [props.assistantName])
)
const composerPlaceholder = computed(() =>
	props.commands.length
		? __('{0}, or type / for commands', [props.placeholder])
		: props.placeholder
)

const toolLabel = computed(() =>
	activeTool.value
		? props.toolLabels[activeTool.value] || __('Working…')
		: __('Thinking…')
)

const voiceTools = useVoice()
watch(() => props.session, setTranscribeSession, { immediate: true })
const mode = ref<VoiceMode>(
	props.voice && voiceTools.canListen && preferredMode() === 'speak'
		? 'speak'
		: 'type'
)
const modes = [
	{ label: __('Type'), value: 'type' },
	{ label: __('Speak'), value: 'speak' },
]

// Hands-free: the mic opens on its own whenever it is the learner's turn, so the
// conversation flows without a tap per reply. The button pauses and resumes it.
const speech = useSpeech()
const held = ref(false)

const toggleListening = () => {
	if (held.value) {
		held.value = false
		speech.stop()
		voiceTools.listen((text) => send(text))
	} else {
		held.value = true
		speech.stop()
		voiceTools.stopListening()
	}
}

watch(
	() =>
		[
			mode.value,
			speech.speaking.value,
			running.value,
			voiceTools.listening.value,
			voiceTools.transcribing.value,
		] as const,
	([currentMode, speakingNow, busy, listening, transcribing]) => {
		if (
			currentMode !== 'speak' ||
			held.value ||
			speakingNow ||
			busy ||
			listening ||
			transcribing ||
			awaitingAnswer.value
		)
			return
		if (props.disabled || props.readOnly) return
		// A denied microphone or a failing engine would otherwise reopen in a loop;
		// the error stays on screen and the mic button retries.
		if (voiceTools.error.value) {
			held.value = true
			return
		}
		if (messages.value.length) voiceTools.listen((text) => send(text))
	}
)

// In speak mode, the voice starts as soon as the first sentence of a streaming
// reply is complete, instead of waiting for the whole reply: the biggest part of
// the gap the learner feels. One turn can stream several replies (a line, an
// exercise, another line), so each streamed reply keeps the part already queued,
// and the finished turn only reads what is left of each. Without that the first
// reply was read twice.
let spokenCount = 0
let streamed: string[] = []
let current = ''
const closeStream = () => {
	if (current) streamed.push(current)
	current = ''
}
watch(partial, (text) => {
	if (mode.value !== 'speak') return
	if (!text || !text.startsWith(current)) closeStream()
	if (!text) return
	const settled = text.slice(current.length).match(/^[\s\S]*[.!?](?=\s)/)
	if (settled) {
		speech.enqueue(settled[0], props.character || 'lumi')
		current += settled[0]
	}
})
watch(
	() => [messages.value.length, running.value] as const,
	() => {
		const replies = messages.value.filter(
			(message) => message.role === 'assistant'
		)
		if (mode.value === 'speak' && !running.value) {
			closeStream()
			for (const reply of replies.slice(spokenCount)) {
				const said = streamed.findIndex(
					(prefix) => prefix && reply.text.startsWith(prefix)
				)
				const skip = said >= 0 ? streamed.splice(said, 1)[0].length : 0
				speech.enqueue(reply.text.slice(skip), props.character || 'lumi')
			}
		}
		if (!running.value) {
			spokenCount = replies.length
			streamed = []
			current = ''
		}
	}
)
watch(mode, (value) => {
	rememberMode(value)
	spokenCount = messages.value.filter(
		(message) => message.role === 'assistant'
	).length
	if (value === 'type') speech.stop()
})

// The stage shows one activity at a time: the newest the learner has not answered.
const currentMoment = computed(() => {
	for (let i = messages.value.length - 1; i >= 0; i--) {
		for (const item of messages.value[i].moments) {
			if (!results.value[item.id]) return item
		}
	}
	return null
})

// What the stage shows: while the voice is still giving feedback on the last
// answer, the answered exercise stays up. The next one appears once the whole reply
// has streamed and the voice reaches its last sentence, which invites them to try
// it, so the exercise arrives with her words instead of after a silence.
const shownMoment = ref<Moment | null>(null)
watch(
	() =>
		[
			currentMoment.value,
			speech.speaking.value,
			speech.remaining.value,
			running.value,
		] as const,
	([target, speakingNow, left, busy]) => {
		if (!shownMoment.value || (!busy && (!speakingNow || left === 0)))
			shownMoment.value = target
	},
	{ immediate: true }
)

// An exercise is answered by tapping, so the mic waits instead of recording silence.
const awaitingAnswer = computed(
	() => !!shownMoment.value && !results.value[shownMoment.value.id]
)
watch(awaitingAnswer, (waiting) => {
	if (!waiting) return
	if (voiceTools.listening.value) voiceTools.stopListening()
	// A mic hiccup from before the exercise is old news once it is up.
	voiceTools.error.value = null
})

const heardWords = computed(() => {
	const words = voiceTools.transcript.value
	if (!words) return ''
	const live = voiceTools.listening.value || voiceTools.transcribing.value
	return live || running.value ? words : ''
})
const micStatus = computed(() => {
	if (held.value) return __('Paused. Tap the mic when you want to continue.')
	if (heardWords.value) return heardWords.value
	if (voiceTools.listening.value) return __('Listening…')
	if (voiceTools.transcribing.value) return __('Noting that down…')
	if (awaitingAnswer.value)
		return __('Answer the exercise, then we keep talking')
	if (speech.speaking.value) return __('Tap the mic to pause')
	return running.value ? __('Thinking…') : ''
})

// The tutor reads the answer as a hidden message and replies to it.
const answerMoment = (payload: Record<string, unknown>) => {
	if (running.value || results.value[payload.id as string]) return
	voiceTools.transcript.value = ''
	emit('moment', payload)
	send(MOMENT_RESULT + JSON.stringify(payload))
}

// "/" opens the commands; typing narrows them, arrows move, Enter or Tab picks.
const commandIndex = ref(0)
const commandMatches = computed(() => {
	const text = draft.value
	if (!props.commands.length || !text.startsWith('/') || /\s/.test(text))
		return []
	const query = text.slice(1).toLowerCase()
	return props.commands.filter((command) => command.name.startsWith(query))
})
watch(commandMatches, () => (commandIndex.value = 0))

const runCommand = (command: { message: string }) => {
	draft.value = ''
	if (running.value || props.disabled) return
	send(command.message)
}

const onComposerKey = (event: KeyboardEvent) => {
	const matches = commandMatches.value
	if (matches.length) {
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault()
			const step = event.key === 'ArrowDown' ? 1 : -1
			commandIndex.value =
				(commandIndex.value + step + matches.length) % matches.length
			return
		}
		if (event.key === 'Enter' || event.key === 'Tab') {
			event.preventDefault()
			runCommand(matches[commandIndex.value])
			return
		}
		if (event.key === 'Escape') {
			draft.value = ''
			return
		}
	}
	if (event.key === 'Enter' && !event.shiftKey) {
		event.preventDefault()
		submit()
	}
}

const saySimpler = (message: ChatMessage) => {
	if (running.value || props.disabled) return
	const latest = messages.value
		.filter((item) => item.role === 'assistant' && item.text)
		.at(-1)
	if (latest?.key === message.key)
		return send(__('Can you say that more simply?'))
	const gist = message.text.replace(/\s+/g, ' ').trim().slice(0, 120)
	send(__('Can you say this more simply? "{0}"', [gist]))
}

const replay = (message: ChatMessage) => {
	speech.stop()
	speech.enqueue(message.text, props.character || 'lumi')
}

// The first cited document in the message, opened at its page.
const sourceOf = (message: ChatMessage): string | undefined => {
	if (!sourceLink) return undefined
	const cited = message.text.match(
		/\[([^[\]]+? · p\.\d+(?:[-–]\d+)?(?:,\s*p\.\d+(?:[-–]\d+)?)*)\]/
	)
	return (cited && sourceLink(cited[1])) || undefined
}

const submit = () => {
	const text = draft.value.trim()
	if (!text || running.value || props.disabled) return
	draft.value = ''
	send(text)
}

watch(
	() => [messages.value.length, partial.value, running.value, props.done],
	async () => {
		emit(
			'messages',
			messages.value.filter((message) => message.role === 'user').length
		)
		await nextTick()
		scroller.value?.scrollTo({ top: scroller.value.scrollHeight })
	}
)

defineExpose({ send })
</script>
