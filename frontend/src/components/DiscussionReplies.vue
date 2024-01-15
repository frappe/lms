<template>
	<div class="mt-6">
		<div class="flex items-center mb-5">
			<Button variant="subtle" @click="showTopics = true">
				<ChevronLeft class="w-4 h-4 stroke-1.5" />
			</Button>
			<span class="text-lg font-semibold ml-2">
				{{ topic.title }}
			</span>
		</div>

		<div v-for="(reply, index) in replies.data">
			<div
				class="py-3"
				:class="{ 'border-b': index + 1 != replies.data.length }"
			>
				<div class="flex items-center mb-2">
					<UserAvatar :user="reply.user" class="mr-2" />
					<span>
						{{ reply.user.full_name }}
					</span>
					<span class="text-sm ml-2">
						{{ timeAgo(reply.creation) }}
					</span>
				</div>
				<div v-html="reply.reply"></div>
			</div>
		</div>
		<TextEditor
			:content="newReply"
			@change="(val) => (newReply = val)"
			placeholder="Type your reply here..."
			editorClass="prose-sm py-2 px-2 min-h-[100px] border-gray-300 hover:border-gray-400 rounded-md bg-gray-200 w-full mt-5"
		/>
		<div class="flex justify-between mt-2">
			<span> </span>
			<Button @click="postReply()">
				<span>
					{{ __('Post') }}
				</span>
			</Button>
		</div>
	</div>
</template>
<script setup>
import { createResource, TextEditor, Button } from 'frappe-ui'
import { timeAgo } from '../utils'
import UserAvatar from '@/components/UserAvatar.vue'
import { ChevronLeft } from 'lucide-vue-next'
import { ref, inject, onMounted } from 'vue'

const showTopics = defineModel('showTopics')
const newReply = ref('')
const socket = inject('$socket')

const props = defineProps({
	topic: {
		type: Object,
		required: true,
	},
})

console.log(socket)
socket.on('publish_message', (data) => {
	console.log('publish')
	console.log(data)
	replies.reload()
})

const replies = createResource({
	url: 'lms.lms.utils.get_discussion_replies',
	cache: ['replies', props.topic],
	makeParams(values) {
		return {
			topic: props.topic.name,
		}
	},
	auto: true,
})

const newReplyResource = createResource({
	url: 'frappe.client.insert',
	makeParams(values) {
		return {
			doc: {
				doctype: 'Discussion Reply',
				reply: newReply.value,
				topic: props.topic.name,
			},
		}
	},
})

const postReply = () => {
	newReplyResource.submit(
		{},
		{
			validate() {
				if (!newReply.value) {
					return __('Reply cannot be empty')
				}
			},
			onSuccess() {
				newReply.value = ''
				replies.reload()
			},
		}
	)
}
</script>
