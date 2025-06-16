<template>
	<div class="flex flex-col">
		<!-- User Message -->
		<div class="flex flex-col w-full items-end">
			<div class="text-justify max-w-4/5 bg-blue-600 px-3 py-2 rounded text-sm font-medium text-white mb-4">
				{{ userMessage }}
			</div>
		</div>
		<!-- Bot Response -->
		<div class="flex flex-row w-full items-start gap-x-2 max-w-4/5" :class="{ 'mb-4': !isLast }">
			<!-- Logo Image -->
			<img v-if="branding.data?.banner_image" :src="branding.data?.banner_image.file_url" alt="Assistant Logo"
				class="w-5 h-5 rounded-full mt-2" />
			<LMSLogo v-else class="w-5 h-5 rounded-full flex-shrink-0" />
			<div class="bg-gray-300 rounded px-3 py-2">
				<!-- Bot Response Text -->
				<img v-if="botResponse === ''" :src="loadingChat" class="h-4 w-10" alt="Loading..." />
				<div v-else v-html="DOMPurify.sanitize(props.botResponse)" ref="messageRef"
					class="leading-loose text-sm" />

				<details v-if="sources.length > 0" class="relative rounded-md mt-2 w-full">
					<summary style="color: #135CA2"
						class="cursor-pointer text-gray-700 text-sm font-medium rounded-full bg-gray-100 py-1.5 px-3 hover:bg-gray-200 inline-flex items-center">
						Sources
						<ChevronDownIcon
							class="w-4 h-4 ml-2 transition-transform duration-200 transform details-[open]:rotate-180" />
					</summary>

					<div class="rounded-md mt-3 w-full max-w-full">
						<div v-for="(source, index) in sources" :key="index" class="space-y-2">
							<a :href="source.url" target="_blank" rel="noopener noreferrer"
								class="block source-item relative p-3 bg-gray-50 rounded-lg mb-2 w-full max-w-full hover:bg-gray-100">
								<!-- Source Text and External Icon (horizontally aligned) -->
								<div class="flex justify-between items-center">
									<!-- Snippet acts as a clickable link -->
									<div style="color: #135CA2" class="text-sm font-medium text-black">
										{{ source.snippet.length > 185
											? `${source.snippet.substring(0, 185)}...`
											: source.snippet }}
									</div>

									<!-- External icon remains clickable -->
									<ExternalLinkIcon class="w-4 h-4 ml-2" />
								</div>

								<!-- Source URL (below the text, acts as a clickable link) -->
								<div class="text-xs text-gray-500 break-all mt-1">
									{{ source.url }}
								</div>

								<!-- Display source pages if available -->
								<div v-if="source.page" class="text-xs text-gray-600 mt-1">
									Page:
									{{ Array.isArray(source.page)
										? source.page
											.join(', ')
											.replace(/,([^,]*)$/, ', dan$1')
										: source.page }}
								</div>
							</a>
						</div>
					</div>
				</details>
			</div>
		</div>
	</div>
</template>

<script setup>
import { ChevronDownIcon, ExternalLinkIcon } from 'lucide-vue-next';
import loadingChat from '@/assets/images/chat-loading.gif'
import LMSLogo from './Icons/LMSLogo.vue';
import DOMPurify from 'dompurify'
import { sessionStore } from '@/stores/session'
import { ref } from 'vue';
const { branding } = sessionStore()

const props = defineProps({
	userMessage: {
		type: String,
		required: true,
	},
	botResponse: {
		type: String,
	},
	isLast: {
		type: Boolean,
		default: false,
	},
	sources: {
		type: Array,
		default: [],
	}
})
const messageRef = ref(null)
</script>

<style>
.alert-message p {
	line-height: 1.2;
}
</style>