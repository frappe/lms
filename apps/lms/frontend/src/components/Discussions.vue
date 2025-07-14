<template>
	<div>
		<Button
			v-if="!singleThread && !readOnlyMode"
			class="float-right"
			@click="openTopicModal()"
		>
			{{ __('New {0}').format(singularize(title)) }}
		</Button>
		<div class="text-xl font-semibold text-ink-gray-9">
			{{ __(title) }}
		</div>
	</div>
	<div v-if="topics.data?.length && !singleThread">
		<div v-if="showTopics" v-for="(topic, index) in topics.data">
			<div
				@click="showReplies(topic)"
				class="flex items-center cursor-pointer py-5 w-full"
				:class="{ 'border-b': index + 1 != topics.data.length }"
			>
				<UserAvatar :user="topic.user" size="2xl" class="mr-4" />
				<div>
					<div class="text-lg font-semibold mb-1 text-ink-gray-7">
						{{ topic.title }}
					</div>
					<div class="flex items-center text-ink-gray-5">
						<span>
							{{ topic.user.full_name }}
						</span>
						<span class="text-sm ml-3">
							{{ timeAgo(topic.creation) }}
						</span>
					</div>
				</div>
			</div>
		</div>
		<div v-else>
			<DiscussionReplies
				:topic="currentTopic"
				v-model:showTopics="showTopics"
			/>
		</div>
	</div>
	<div v-else-if="singleThread && topics.data">
		<DiscussionReplies :topic="topics.data" :singleThread="singleThread" />
	</div>
	<div
		v-else
		class="flex flex-col items-center justify-center border-2 border-dashed mt-5 py-8 rounded-md"
	>
		<MessageSquareText class="w-7 h-7 text-ink-gray-4 stroke-1.5 mr-2" />
		<div class="">
			<div v-if="emptyStateTitle" class="font-medium mb-2">
				{{ __(emptyStateTitle) }}
			</div>
			<div class="text-ink-gray-5">
				{{ __(emptyStateText) }}
			</div>
		</div>
	</div>
	<DiscussionModal
		v-model="showTopicModal"
		:title="__('New {0}').format(title)"
		:doctype="props.doctype"
		:docname="props.docname"
		v-model:reloadTopics="topics"
	/>
</template>
<script setup>
import { createResource, Button } from 'frappe-ui'
import UserAvatar from '@/components/UserAvatar.vue'
import { singularize, timeAgo } from '../utils'
import { ref, onMounted, inject } from 'vue'
import DiscussionReplies from '@/components/DiscussionReplies.vue'
import DiscussionModal from '@/components/Modals/DiscussionModal.vue'
import { MessageSquareText } from 'lucide-vue-next'
import { getScrollContainer } from '@/utils/scrollContainer'

const showTopics = ref(true)
const currentTopic = ref(null)
const socket = inject('$socket')
const user = inject('$user')
const showTopicModal = ref(false)
const readOnlyMode = window.read_only_mode

const props = defineProps({
	title: {
		type: String,
		required: true,
	},
	doctype: {
		type: String,
		required: true,
	},
	docname: {
		type: String,
		required: true,
	},
	emptyStateTitle: {
		type: String,
		default: '',
	},
	emptyStateText: {
		type: String,
		default: 'Start a discussion',
	},
	singleThread: {
		type: Boolean,
		default: false,
	},
	scrollToBottom: {
		type: Boolean,
		default: false,
	},
})

onMounted(() => {
	if (user.data) topics.reload()

	socket.on('new_discussion_topic', (data) => {
		topics.refresh()
	})

	if (props.scrollToBottom) {
		setTimeout(() => {
			scrollToEnd()
		}, 100)
	}
})

const scrollToEnd = () => {
	let scrollContainer = getScrollContainer()
	scrollContainer.scrollTop = scrollContainer.scrollHeight
}

const topics = createResource({
	url: 'lms.lms.utils.get_discussion_topics',
	cache: ['topics', props.doctype, props.docname],
	makeParams() {
		return {
			doctype: props.doctype,
			docname: props.docname,
			single_thread: props.singleThread,
		}
	},
})

const showReplies = (topic) => {
	showTopics.value = false
	currentTopic.value = topic
}

const openTopicModal = () => {
	showTopicModal.value = true
}
</script>
