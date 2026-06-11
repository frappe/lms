<template>
	<div>
		<Button
			v-if="!singleThread && !readOnlyMode"
			class="float-end"
			@click="openTopicModal()"
		>
			<template #prefix>
				<span class="lucide-plus size-4" />
			</template>
			{{ __('New {0}').format(singularize(title)) }}
		</Button>
		<div class="text-3xl-semibold text-ink-gray-9">
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
				<UserAvatar :user="topic.user" size="2xl" class="me-4" />
				<div>
					<div class="text-xl-semibold mb-1 text-ink-gray-7">
						{{ topic.title }}
					</div>
					<div class="flex items-center text-ink-gray-5">
						<span>
							{{ topic.user.full_name }}
						</span>
						<span class="text-sm ms-3">
							{{ timeAgo(topic.creation) }}
						</span>
						<span class="flex items-center gap-1 text-sm ms-3">
							<span class="lucide-message-square size-3.5" />
							{{
								(topic.reply_count === 1
									? __('{0} reply')
									: __('{0} replies')
								).format(topic.reply_count || 0)
							}}
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
		<span class="lucide-message-square-text size-7 text-ink-gray-4 me-2" />
		<div class="mt-2">
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
		@created="openCreatedTopic"
	/>
</template>
<script setup>
import { createResource, Button } from 'frappe-ui'
import UserAvatar from '@/components/UserAvatar.vue'
import { singularize, timeAgo } from '@/utils'
import { ref, onMounted, inject, onUnmounted } from 'vue'
import DiscussionReplies from '@/components/DiscussionReplies.vue'
import DiscussionModal from '@/components/Modals/DiscussionModal.vue'
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
		default: 'Start a Discussion',
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

// After a new question is posted, jump straight into its thread instead of
// leaving the user on the list.
const openCreatedTopic = (topicName) => {
	const topic = topics.data?.find((t) => t.name === topicName)
	if (topic) showReplies(topic)
}

onUnmounted(() => {
	socket.off('new_discussion_topic')
})
</script>
