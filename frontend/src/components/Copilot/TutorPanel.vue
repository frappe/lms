<template>
	<template v-if="enabled">
		<button
			v-if="!open"
			type="button"
			data-testid="tutor-open"
			class="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] start-4 z-30 flex h-11 items-center gap-2 rounded-full bg-surface-gray-10 px-4 text-p-sm font-medium text-ink-base shadow-lg hover:bg-surface-gray-9 focus:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-4 sm:bottom-6 sm:end-6 sm:start-auto"
			:aria-expanded="open"
			aria-controls="copilot-tutor-panel"
			@click="openPanel"
		>
			<span class="lucide-sparkles size-4" aria-hidden="true" />
			{{ __('Ask the tutor') }}
		</button>

		<div
			v-if="open"
			id="copilot-tutor-panel"
			role="dialog"
			aria-modal="false"
			:aria-label="__('Learning Copilot')"
			class="fixed inset-0 z-40 flex flex-col bg-surface-base sm:inset-y-0 sm:end-0 sm:start-auto sm:w-[400px] sm:border-s sm:shadow-2xl"
			@keydown.esc="open = false"
		>
			<div
				class="pt-safe-3 flex items-center gap-2 border-b px-4 pb-3 text-ink-gray-9"
			>
				<span
					class="lucide-sparkles size-4 text-ink-gray-6"
					aria-hidden="true"
				/>
				<div class="min-w-0 flex-1">
					<div class="truncate text-p-base font-semibold">
						{{ __('Learning Copilot') }}
					</div>
					<div class="truncate text-p-xs text-ink-gray-5">
						{{ __('Answers come from this course and cite their lessons.') }}
					</div>
				</div>
				<Button
					v-if="messages.length"
					variant="ghost"
					:label="__('New conversation')"
					:disabled="sending"
					@click="resetConversation"
				>
					<template #icon>
						<span class="lucide-rotate-ccw size-4" />
					</template>
				</Button>
				<Button variant="ghost" :label="__('Close')" @click="open = false">
					<template #icon>
						<span class="lucide-x size-4" />
					</template>
				</Button>
			</div>

			<div
				ref="scroller"
				class="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4"
				aria-live="polite"
			>
				<div
					v-if="!messages.length"
					class="space-y-3 text-p-sm text-ink-gray-7"
				>
					<p>
						{{
							__(
								'Ask about this lesson. The tutor answers from your course material and links to the lessons it used.'
							)
						}}
					</p>
					<div class="flex flex-wrap gap-2">
						<Button
							v-for="suggestion in suggestions"
							:key="suggestion"
							size="sm"
							variant="subtle"
							@click="send(suggestion)"
						>
							{{ suggestion }}
						</Button>
					</div>
				</div>
				<TutorMessage
					v-for="(message, index) in messages"
					:key="message.id || index"
					:message="message"
					:sessionId="sessionId"
					@update="(patch) => updateMessage(index, patch)"
					@navigate="onNavigate"
				/>
				<div
					v-if="sending"
					class="flex items-center gap-2 text-p-sm text-ink-gray-5"
					data-testid="tutor-loading"
				>
					<LoadingIndicator class="size-4" />
					{{ __('The tutor is thinking…') }}
				</div>
			</div>

			<form class="pb-safe-3 border-t px-4 pt-3" @submit.prevent="send()">
				<div class="flex items-end gap-2">
					<textarea
						ref="inputEl"
						v-model="draft"
						rows="2"
						maxlength="4000"
						data-testid="tutor-input"
						class="block min-h-[2.75rem] max-h-40 flex-1 resize-none rounded-5 border border-outline-gray-2 bg-surface-gray-2 px-3 py-2 text-p-sm text-ink-gray-9 placeholder-ink-gray-4 focus:border-outline-gray-4 focus:ring-0"
						:placeholder="__('Ask a question about this lesson')"
						:aria-label="__('Your question')"
						@keydown.enter.exact.prevent="send()"
					/>
					<Button
						type="submit"
						variant="solid"
						class="!h-11"
						:label="__('Send')"
						:disabled="!draft.trim() || sending"
					>
						<template #icon>
							<span class="lucide-send size-4" />
						</template>
					</Button>
				</div>
				<p class="mt-1.5 text-p-xs text-ink-gray-4">
					{{ __('AI answers can be wrong. Check the cited lessons.') }}
				</p>
			</form>
		</div>
	</template>
</template>
<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { Button, LoadingIndicator } from 'frappe-ui'
import { copilotCall } from '@/copilot/api'
import TutorMessage from '@/components/Copilot/tutor/TutorMessage.vue'
import {
	clearConversation,
	loadConversation,
	saveConversation,
	sendChat,
} from '@/components/Copilot/tutor/gateway'
import { useScreenSize } from '@/utils/composables'

const props = defineProps({
	course: { type: String, required: true },
	lesson: { type: String, default: '' },
})

const enabled = ref(false)
const open = ref(false)
const sending = ref(false)
const draft = ref('')
const sessionId = ref('')
const messages = ref([])
const scroller = ref(null)
const inputEl = ref(null)
const { isMobile } = useScreenSize()

const suggestions = computed(() => [
	__('Explain this lesson simply'),
	__('Give me an example'),
	__('What should I review before the next lesson?'),
])

onMounted(async () => {
	try {
		const context = await copilotCall('get_session_context')
		enabled.value = Boolean(context?.learner_widget)
	} catch (error) {
		enabled.value = false
	}
})

const restore = () => {
	const stored = loadConversation(props.course, props.lesson)
	sessionId.value = stored.sessionId
	messages.value = stored.messages
}

watch(() => [props.course, props.lesson], restore, { immediate: true })

const persist = () =>
	saveConversation(props.course, props.lesson, {
		sessionId: sessionId.value,
		messages: messages.value,
	})

const scrollToEnd = async () => {
	await nextTick()
	if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight
}

const openPanel = async () => {
	open.value = true
	await scrollToEnd()
	inputEl.value?.focus()
}

const onNavigate = () => {
	// A citation opens another lesson; on a phone the drawer covers it.
	if (isMobile.value) open.value = false
}

let nextId = Date.now()

const send = async (text) => {
	const question = String(text ?? draft.value).trim()
	if (!question || sending.value) return
	if (text === undefined) draft.value = ''
	messages.value.push({ id: nextId++, role: 'user', text: question })
	sending.value = true
	scrollToEnd()
	try {
		const data = await sendChat({
			message: question,
			sessionId: sessionId.value,
			page: window.location.pathname,
		})
		if (data.session_id) sessionId.value = String(data.session_id)
		messages.value.push({
			id: nextId++,
			role: 'assistant',
			text: String(data.answer || ''),
			tutor: data.tutor || null,
			question,
		})
	} catch (error) {
		messages.value.push({
			id: nextId++,
			role: 'assistant',
			error: true,
			text: __('The tutor could not answer: {0}').format(error.message),
		})
	} finally {
		sending.value = false
		persist()
		scrollToEnd()
	}
}

const updateMessage = (index, patch) => {
	messages.value[index] = { ...messages.value[index], ...patch }
	persist()
}

const resetConversation = () => {
	clearConversation(props.course, props.lesson)
	sessionId.value = ''
	messages.value = []
	inputEl.value?.focus()
}

defineExpose({ send, open })
</script>
