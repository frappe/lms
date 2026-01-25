<template>
	<div
		v-show="show"
		class="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-4 pointer-events-none"
	>
		<transition
			enter-active-class="transition duration-300 ease-out"
			enter-from-class="opacity-0 translate-y-4 scale-95"
			enter-to-class="opacity-100 translate-y-0 scale-100"
			leave-active-class="transition duration-200 ease-in"
			leave-from-class="opacity-100 translate-y-0 scale-100"
			leave-to-class="opacity-0 translate-y-4 scale-95"
		>
			<div
				v-if="!minimize"
				class="pointer-events-auto w-[380px] h-[600px] max-h-[calc(100vh-120px)] flex flex-col bg-surface-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden"
				@click.stop
			>
				<div
					class="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white"
				>
					<div class="flex items-center gap-2">
						<div class="text-base font-semibold text-gray-900">
							CESGS AI Assistant
						</div>
					</div>
					<div class="flex gap-1">
						<Button
							@click="minimize = true"
							variant="ghost"
							size="sm"
							class="h-8 w-8 p-0 hover:bg-gray-100 rounded-full"
						>
							<X class="h-5 w-5 text-gray-500" />
						</Button>
					</div>
				</div>

				<div class="flex-1 overflow-hidden flex flex-col min-h-0 bg-gray-50/50">
					<div ref="chatAreaRef" class="flex-1 overflow-y-auto p-4 space-y-4">
						<template v-if="messages.length === 0">
							<div
								class="h-full flex flex-col items-center justify-center text-center p-6 text-gray-500"
							>
								<div
									class="h-12 w-12 rounded-full bg-blue-50 flex items-center justify-center mb-3"
								>
									<AIStarIcon class="h-6 w-6 text-blue-500" />
								</div>
								<h3 class="font-medium text-gray-900 mb-1">
									How can I help you?
								</h3>
								<p class="text-sm">
									Ask me anything about your course or lessons.
								</p>
							</div>
						</template>
						<AssistantMessage
							v-for="(msg, index) in messages"
							:key="index"
							:userMessage="msg.userMessage"
							:botResponse="msg.botResponse"
							:isLast="index === messages.length - 1"
							:sources="msg.sources"
						/>
					</div>

					<div class="p-3 bg-white border-t border-gray-100">
						<form
							@submit.prevent="sendMessage"
							class="flex justify-between gap-x-2"
						>
							<TextInput
								:type="'text'"
								size="md"
								variant="subtle"
								placeholder="Ask me anything"
								:disabled="isSending"
								v-model="messageText"
								class="w-full"
							/>
							<button
								@click="sendMessage"
								:disabled="isSending"
								class="rounded bg-primary-500 p-2"
							>
								<SendHorizonalIcon class="h-3.5 text-white" />
							</button>
						</form>
					</div>
				</div>
			</div>
		</transition>
		<button
			@click="minimize = !minimize"
			class="pointer-events-auto group relative h-14 w-14 rounded-full bg-gradient-right text-white flex items-center justify-center shadow-lg hover:bg-gray-800 hover:scale-105 active:scale-95 transition-all duration-200"
		>
			<transition
				enter-active-class="transition duration-200 ease-out"
				enter-from-class="opacity-0 rotate-90 scale-50"
				enter-to-class="opacity-100 rotate-0 scale-100"
				leave-active-class="transition duration-200 ease-in"
				leave-from-class="opacity-100 rotate-0 scale-100"
				leave-to-class="opacity-0 -rotate-90 scale-50"
				mode="out-in"
			>
				<AIStarIcon v-if="minimize" class="h-6 w-6" />
				<ChevronDown v-else class="h-7 w-7" />
			</transition>
		</button>
	</div>
</template>

<script setup>
import { Button, TextInput } from 'frappe-ui'
import {
	Minimize2,
	Maximize2,
	SendHorizonalIcon,
	ChevronDown,
} from 'lucide-vue-next'
import { ref, watch } from 'vue'
import MarkdownIt from 'markdown-it'
import AssistantMessage from './AssistantMessage.vue'
import chatSearching from '@/assets/images/search-loading.gif'
import AIStarIcon from './Icons/AIStarIcon.vue'

const props = defineProps({})
const show = defineModel()
const minimize = ref(true)
const messages = ref([])
const messageText = ref('')
const chatAreaRef = ref(null)
const isSending = ref(false)
const bsid = ref(null)
const bcid = ref(null)
const md = new MarkdownIt()
const divWrapper = (htmlContent) => {
	// Regular Expression for finding tables
	const tableRegex = /<table[\s\S]*?<\/table>/gi
	// Regular Expression for finding images
	const imgRegex = /<img[\s\S]*?>/gi
	// Regular Expression for finding links
	const linkRegex = /<a[\s\S]*?>[\s\S]*?<\/a>/gi
	// Replace <table> elements by wrapping them in a div
	let modifiedContent = htmlContent.replace(
		tableRegex,
		(match) => `<div class="table-wrapper">${match}</div>`,
	)
	// Replace <img> elements by wrapping them in a div with center styling
	modifiedContent = modifiedContent.replace(
		imgRegex,
		(match) => `
      <div class="flex justify-center my-4">
          ${match.replace('<img', '<img class="max-w-full h-auto max-h-96"')}
      </div>
  `,
	)
	// Replace <a> elements by adding an underline style with black color
	modifiedContent = modifiedContent.replace(linkRegex, (match) => {
		// Add inline style for black underline if not already styled
		return match.replace(
			'<a',
			'<a style="text-decoration: underline; text-decoration-color: gray;"',
		)
	})
	return modifiedContent
}

const sendMessage = async () => {
	const newMessage = messageText.value
	if (!newMessage) return
	messageText.value = ''
	isSending.value = true
	bsid.value = null
	bcid.value = null
	messages.value = [
		...messages.value,
		{ userMessage: newMessage, botResponse: '' },
	]
	try {
		const response = await fetch('/api/method/lms.lms.api.chat_llm', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				message: newMessage,
				bsid: bsid.value,
			}),
		})
		const reader = response.body?.getReader()
		if (!reader) throw new Error('Response body is null')
		let responseBuffer = ''
		let isDone = false
		while (!isDone) {
			const { done, value } = await reader.read()
			isDone = done
			if (isDone) continue

			const chunk = new TextDecoder().decode(value)
			responseBuffer += chunk // Accumulate the chunks into the buffer

			// Keep searching for the end of the JSON object (closing brace)
			let startIndex = responseBuffer.lastIndexOf('{') // Find the start of a JSON object
			let endIndex = responseBuffer.lastIndexOf('}') // Find the end of the JSON object

			if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
				try {
					// Extract the valid JSON substring
					const jsonString = responseBuffer.substring(startIndex, endIndex + 1)
					const jsonResponse = JSON.parse(jsonString)
					// Reset the buffer to handle any leftover data after the valid JSON object
					responseBuffer = responseBuffer.slice(endIndex + 1)
					const {
						response: partialResponse,
						tools,
						bsid: newBsid,
						bcid: newBcid,
					} = jsonResponse

					if (tools && tools.length > 0) {
						const interimResult = tools[tools.length - 1]
						messages.value.pop()
						messages.value = [
							...messages.value,
							{
								userMessage: newMessage,
								botResponse: `<div class="text-sm font-bold flex items-center gap-x-2">
								<img src="${chatSearching}" class="h-6 w-6" />
								${md.render(interimResult)}
							</div>`,
							},
						]
					}

					if (partialResponse) {
						const processedHtml = divWrapper(md.render(partialResponse))
						const finalResponse = `<div>${processedHtml}</div>`
						messages.value.pop()
						messages.value = [
							...messages.value,
							{
								userMessage: newMessage,
								botResponse: finalResponse,
							},
						]
					}
					// Save the new bsid and bcid correctly
					if (newBsid) bsid.value = newBsid
					if (newBcid) bcid.value = newBcid
				} catch (e) {
					console.error('Error parsing JSON:', e)
				}
			}
		}
	} catch (error) {
		console.error('Error:', error)
		// Handle error, use a valid string for botResponse
		messages.value.pop()
		messages.value = [
			...messages.value,
			{
				userMessage: newMessage,
				botResponse:
					'<div class="alert-message"><p>An error occurred. Please try again.</p></div>',
			},
		]
	} finally {
		isSending.value = false
	}
}

watch(messages, () => {
	if (chatAreaRef.value) {
		chatAreaRef.value.scrollTop = chatAreaRef.value.scrollHeight
	}
})

watch([bcid, bsid], ([newBcid, newBsid]) => {
	if (newBcid && newBsid) {
		// Make sure bsid and bcid are set
		try {
			const fetchSources = async () => {
				const response = await fetch(
					'/api/method/lms.lms.api.llm_get_sources',
					{
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							bsid: newBsid,
							bcid: newBcid,
						}),
					},
				)
				// if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
				const sources = await response.json()
				if (sources) {
					// Update the message with sources
					setTimeout(() => {
						// Defer the state update to the next event loop cycle
						const messagesLength = messages.value.length
						const lastMessage = messages.value[messagesLength - 1]
						const updatedMessage = {
							...lastMessage, // Copy the last message
							sources: sources.message, // Add or update sources field
						}
						messages.value.pop()
						messages.value = [...messages.value, updatedMessage]
					}, 0) // Set timeout of 0 to let the rendering phase complete
				}
			}
			fetchSources()
		} catch (e) {
			console.error('Error fetching sources:', e)
		}
	}
})
</script>
