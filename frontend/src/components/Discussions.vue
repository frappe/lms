<template>
	<div>
		<Button v-if="!singleThread" class="float-right" @click="openTopicModal()">
			{{ __('New {0}').format(title) }}
		</Button>
		<div class="text-xl font-semibold">
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
					<div class="text-lg font-semibold mb-1">
						{{ topic.title }}
					</div>
					<div class="flex items-center">
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
	<div v-else class="flex justify-center border mt-5 p-5 rounded-md">
		<MessageSquareIcon class="w-10 h-10 stroke-1.5 text-gray-800 mr-2" />
		<div>
			<div class="text-xl font-semibold mb-2">
				{{ __(emptyStateTitle) }}
			</div>
			<div>
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
import { createResource, Button, TextEditor } from 'frappe-ui'
import UserAvatar from '@/components/UserAvatar.vue'
import { timeAgo } from '../utils'
import { ref, onMounted, inject } from 'vue'
import DiscussionReplies from '@/components/DiscussionReplies.vue'
import DiscussionModal from '@/components/Modals/DiscussionModal.vue'
import { MessageSquareIcon } from 'lucide-vue-next'

const showTopics = ref(true)
const currentTopic = ref(null)
const socket = inject('$socket')
const user = inject('$user')
const showTopicModal = ref(false)

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
		default: 'No topics yet',
	},
	emptyStateText: {
		type: String,
		default: 'Be the first to start a discussion',
	},
	singleThread: {
		type: Boolean,
		default: false,
	},
})

onMounted(() => {
	if (user.data) topics.reload()

	socket.on('new_discussion_topic', (data) => {
		topics.refresh()
	})
})

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
