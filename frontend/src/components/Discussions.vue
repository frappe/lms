<template>
	<div v-if="topics.data">
		<div>
			<Button class="float-right" @click="openQuestionModal()">
				{{ __('Ask a Question') }}
			</Button>
			<div class="text-xl font-semibold">
				{{ __(title) }}
			</div>
		</div>
		<div v-if="showTopics" v-for="(topic, index) in topics.data">
			<div
				@click="showReplies(topic)"
				class="flex items-center cursor-pointer py-5"
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
						<span class="text-sm ml-2">
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
</template>
<script setup>
import { createResource, Button } from 'frappe-ui'
import UserAvatar from '@/components/UserAvatar.vue'
import { timeAgo } from '../utils'
import { ref, onMounted, inject } from 'vue'
import DiscussionReplies from '@/components/DiscussionReplies.vue'

const showTopics = ref(true)
const currentTopic = ref(null)
const socket = inject('$socket')
const showQuestionModal = ref(false)

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
})

onMounted(() => {
	socket.on('new_discussion_topic', (data) => {
		topics.refresh()
	})
})

const topics = createResource({
	url: 'lms.lms.utils.get_discussion_topics',
	cache: ['topics', props.doctype, props.docname],
	params: {
		doctype: props.doctype,
		docname: props.docname,
	},
	auto: true,
})

const showReplies = (topic) => {
	showTopics.value = false
	currentTopic.value = topic
}

const openQuestionModal = () => {
	showQuestionModal.value = true
}
</script>
