<template>
	<div v-show="show"
		class="fixed z-50 right-0 w-[350px] h-[calc(100%_-_300px)] text-ink-gray-9 m-5 mt-[230px] p-3 flex gap-2 flex-col justify-between rounded-lg bg-surface-modal shadow-2xl"
		:class="{ 'top-[calc(100%_-_290px)] border': minimize }" @click.stop>
		<div class="flex items-center justify-between px-2 py-1.5">
			<div class="text-base font-medium">
				AI Assistant
			</div>
			<div class="flex gap-1">
				<Button @click="minimize = !minimize" variant="ghost">
					<component :is="minimize ? Maximize2 : Minimize2" class="h-3.5" />
				</Button>
			</div>
		</div>
		<div class="h-full overflow-hidden flex flex-col gap-y-2">
			<!-- Chat container -->
			<div ref="chatAreaRef" class="h-[calc(100%_-_30px)] overflow-y-auto rounded bg-surface-gray-1 p-4">
				<AssistantMessage v-for="(msg, index) in messages" :key="index" :userMessage="msg.userMessage"
					:botResponse="msg.botResponse" :isLast="index === messages.length - 1" :sources="msg.sources" />
			</div>
			<!-- Chat input -->
			<form @submit.prevent="sendMessage" class="flex justify-between gap-x-2">
				<TextInput :type="'text'" size="md" variant="subtle" placeholder="Ask me anything" :disabled="isSending"
					v-model="messageText" class="w-full" />
				<button @click="sendMessage" :disabled="isSending" class="rounded bg-blue-500 p-2">
					<SendHorizonalIcon class="h-3.5 text-white" />
				</button>
			</form>
		</div>
	</div>
</template>

<script setup>
import { Button, TextInput } from 'frappe-ui'
import {
	Minimize2,
	Maximize2,
	SendHorizonalIcon
} from 'lucide-vue-next'
import { ref, watch } from 'vue'
import MarkdownIt from 'markdown-it'
import AssistantMessage from './AssistantMessage.vue'
import chatSearching from '@/assets/images/search-loading.gif'

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
	const tableRegex = /<table[\s\S]*?<\/table>/gi;
	// Regular Expression for finding images
	const imgRegex = /<img[\s\S]*?>/gi;
	// Regular Expression for finding links
	const linkRegex = /<a[\s\S]*?>[\s\S]*?<\/a>/gi;
	// Replace <table> elements by wrapping them in a div
	let modifiedContent = htmlContent.replace(
		tableRegex,
		(match) => `<div class="table-wrapper">${match}</div>`
	);
	// Replace <img> elements by wrapping them in a div with center styling
	modifiedContent = modifiedContent.replace(
		imgRegex,
		(match) => `
      <div class="flex justify-center my-4">
          ${match.replace('<img', '<img class="max-w-full h-auto max-h-96"')}
      </div>
  `
	);
	// Replace <a> elements by adding an underline style with black color
	modifiedContent = modifiedContent.replace(linkRegex, (match) => {
		// Add inline style for black underline if not already styled
		return match.replace(
			'<a',
			'<a style="text-decoration: underline; text-decoration-color: gray;"'
		);
	});
	return modifiedContent;
}

const sendMessage = async () => {
	const newMessage = messageText.value;
	if (!newMessage) return;
	messageText.value = '';
	isSending.value = true;
	bsid.value = null;
	bcid.value = null;
	messages.value = [...messages.value, { userMessage: newMessage, botResponse: '' }];
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
		});
		const reader = response.body?.getReader();
		if (!reader) throw new Error('Response body is null');
		let responseBuffer = '';
		let isDone = false;
		while (!isDone) {
			const { done, value } = await reader.read();
			isDone = done;
			if (isDone) continue;

			const chunk = new TextDecoder().decode(value);
			responseBuffer += chunk; // Accumulate the chunks into the buffer

			// Keep searching for the end of the JSON object (closing brace)
			let startIndex = responseBuffer.lastIndexOf('{'); // Find the start of a JSON object
			let endIndex = responseBuffer.lastIndexOf('}'); // Find the end of the JSON object

			if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
				try {
					// Extract the valid JSON substring
					const jsonString = responseBuffer.substring(
						startIndex,
						endIndex + 1
					);
					const jsonResponse = JSON.parse(jsonString);
					// Reset the buffer to handle any leftover data after the valid JSON object
					responseBuffer = responseBuffer.slice(endIndex + 1);
					const {
						response: partialResponse,
						tools,
						bsid: newBsid,
						bcid: newBcid,
					} = jsonResponse;

					if (tools && tools.length > 0) {
						const interimResult = tools[tools.length - 1];
						messages.value.pop()
						messages.value = [...messages.value, {
							userMessage: newMessage,
							botResponse: `<div class="text-sm font-bold flex items-center gap-x-2">
								<img src="${chatSearching}" class="h-6 w-6" />
								${md.render(interimResult)}
							</div>`,
						}]
					}

					if (partialResponse) {
						const processedHtml = divWrapper(md.render(partialResponse));
						const finalResponse = `<div>${processedHtml}</div>`;
						messages.value.pop()
						messages.value = [...messages.value, {
							userMessage: newMessage,
							botResponse: finalResponse,
						}]
					}
					// Save the new bsid and bcid correctly
					if (newBsid) bsid.value = newBsid;
					if (newBcid) bcid.value = newBcid;
				} catch (e) {
					console.error('Error parsing JSON:', e);
				}
			}
		}
	} catch (error) {
		console.error('Error:', error);
		// Handle error, use a valid string for botResponse
		messages.value.pop()
		messages.value = [...messages.value, {
			userMessage: newMessage,
			botResponse:
				'<div class="alert-message"><p>An error occurred. Please try again.</p></div>',
		}]
	} finally {
		isSending.value = false
	}
}

watch(messages, () => {
	if (chatAreaRef.value) {
		chatAreaRef.value.scrollTop = chatAreaRef.value.scrollHeight;
	}
})

watch([bcid, bsid], ([newBcid, newBsid]) => {
	if (newBcid && newBsid) {
		// Make sure bsid and bcid are set
		try {
			const fetchSources = async () => {
				const response = await fetch('/api/method/lms.lms.api.llm_get_sources', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						bsid: newBsid,
						bcid: newBcid
					}),
				});
				// if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
				const sources = await response.json()
				if (sources) {
					// Update the message with sources
					setTimeout(() => {
						// Defer the state update to the next event loop cycle
						const messagesLength = messages.value.length;
						const lastMessage = messages.value[messagesLength - 1]
						const updatedMessage = {
							...lastMessage, // Copy the last message
							sources: sources.message, // Add or update sources field
						};
						messages.value.pop()
						messages.value = [...messages.value, updatedMessage]
					}, 0); // Set timeout of 0 to let the rendering phase complete
				}
			};
			fetchSources();
		} catch (e) {
			console.error('Error fetching sources:', e);
		}
	}
});
</script>