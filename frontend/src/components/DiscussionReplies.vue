<template>
	<div class="mt-6">
		<div v-if="!singleThread" class="flex items-center mb-5">
			<Button variant="outline" @click="showTopics = true">
				<template #icon>
					<ChevronLeft class="w-5 h-5 stroke-1.5 text-gray-700" />
				</template>
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
				<div class="flex items-center justify-between mb-2">
					<div class="flex items-center">
						<UserAvatar :user="reply.user" class="mr-2" />
						<span>
							{{ reply.user.full_name }}
						</span>
						<span class="text-sm ml-2">
							{{ timeAgo(reply.creation) }}
						</span>
					</div>
					<Dropdown
						v-if="user.data.name == reply.owner && !reply.editable"
						:options="[
							{
								label: 'Edit',
								onClick() {
									reply.editable = true
								},
							},
							{
								label: 'Delete',
								onClick() {
									deleteReply(reply)
								},
							},
						]"
					>
						<template v-slot="{ open }">
							<MoreHorizontal class="w-4 h-4 stroke-1.5 cursor-pointer" />
						</template>
					</Dropdown>
					<div v-if="reply.editable">
						<Button variant="ghost" @click="postEdited(reply)">
							{{ __('Post') }}
						</Button>
						<Button variant="ghost" @click="reply.editable = false">
							{{ __('Discard') }}
						</Button>
					</div>
				</div>
				<TextEditor
					:content="reply.reply"
					@change="(val) => (reply.reply = val)"
					:editable="reply.editable || false"
					:fixedMenu="reply.editable || false"
					:editorClass="
						reply.editable
							? 'ProseMirror prose prose-table:table-fixed prose-td:p-2 prose-th:p-2 prose-td:border prose-th:border prose-td:border-gray-300 prose-th:border-gray-300 prose-td:relative prose-th:relative prose-th:bg-gray-100 prose-sm max-w-none'
							: 'prose-sm'
					"
				/>
			</div>
		</div>

		<TextEditor
			class="mt-5"
			:content="newReply"
			:mentions="mentionUsers"
			@change="(val) => (newReply = val)"
			placeholder="Type your reply here..."
			:fixedMenu="true"
			editorClass="ProseMirror prose prose-table:table-fixed prose-td:p-2 prose-th:p-2 prose-td:border prose-th:border prose-td:border-gray-300 prose-th:border-gray-300 prose-td:relative prose-th:relative prose-th:bg-gray-100 prose-sm max-w-none border border-gray-300 rounded-b-md min-h-[7rem] py-1 px-2"
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
import { createResource, TextEditor, Button, Dropdown } from 'frappe-ui'
import { timeAgo } from '../utils'
import UserAvatar from '@/components/UserAvatar.vue'
import { ChevronLeft, MoreHorizontal } from 'lucide-vue-next'
import { ref, inject, onMounted, computed } from 'vue'
import { createToast } from '../utils'

const showTopics = defineModel('showTopics')
const newReply = ref('')
const socket = inject('$socket')
const user = inject('$user')
const allUsers = inject('$allUsers')

const props = defineProps({
	topic: {
		type: Object,
		required: true,
	},
	singleThread: {
		type: Boolean,
		default: false,
	},
})

onMounted(() => {
	socket.on('publish_message', (data) => {
		replies.reload()
	})
	socket.on('update_message', (data) => {
		replies.reload()
	})
	socket.on('delete_message', (data) => {
		replies.reload()
	})
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

const mentionUsers = computed(() => {
	let users = Object.values(allUsers.data).map((user) => {
		return {
			value: user.name,
			label: user.full_name,
		}
	})
	return users
})

const postReply = () => {
	newReplyResource.submit(
		{},
		{
			validate() {
				if (!newReply.value) {
					return 'Reply cannot be empty'
				}
			},
			onSuccess() {
				newReply.value = ''
				replies.reload()
			},
			onError(err) {
				createToast({
					title: 'Error',
					text: err.messages?.[0] || err,
					icon: 'x',
					iconClasses: 'bg-red-600 text-white rounded-md p-px',
					position: 'top-center',
					timeout: 10,
				})
			},
		}
	)
}

const editReplyResource = createResource({
	url: 'frappe.client.set_value',
	makeParams(values) {
		return {
			doctype: 'Discussion Reply',
			name: values.name,
			fieldname: 'reply',
			value: values.reply,
		}
	},
})

const postEdited = (reply) => {
	editReplyResource.submit(
		{
			name: reply.name,
			reply: reply.reply,
		},
		{
			validate() {
				if (!reply.reply) {
					return 'Reply cannot be empty'
				}
			},
			onSuccess() {
				reply.editable = false
				replies.reload()
			},
		}
	)
}

const deleteReplyResource = createResource({
	url: 'frappe.client.delete',
	makeParams(values) {
		return {
			doctype: 'Discussion Reply',
			name: values.name,
		}
	},
})

const deleteReply = (reply) => {
	deleteReplyResource.submit(
		{
			name: reply.name,
		},
		{
			onSuccess() {
				replies.reload()
			},
		}
	)
}
</script>
