<template>
	<Dialog
		:options="{
			title: singularize(props.title),
			size: '2xl',
			actions: [
				{
					label: 'Post',
					variant: 'solid',
					onClick: (close) => submitTopic(close),
				},
			],
		}"
	>
		<template #body-content>
			<div class="flex flex-col gap-4">
				<div>
					<FormControl v-model="topic.title" :label="__('Title')" type="text" />
				</div>
				<div>
					<div class="mb-1.5 text-sm text-ink-gray-5">
						{{ __('Details') }}
					</div>
					<TextEditor
						:content="topic.reply"
						@change="(val) => (topic.reply = val)"
						:editable="true"
						:fixedMenu="true"
						editorClass="prose-sm max-w-none border-b border-x border-outline-gray-modals bg-surface-gray-2 rounded-b-md py-1 px-2 min-h-[7rem]"
					/>
				</div>
			</div>
		</template>
	</Dialog>
</template>
<script setup>
import { call, Dialog, FormControl, TextEditor, toast } from 'frappe-ui'
import { reactive } from 'vue'
import { singularize } from '@/utils'
import { useTelemetry } from 'frappe-ui/frappe'

const topics = defineModel('reloadTopics')
const { capture } = useTelemetry()

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

const topic = reactive({
	title: '',
	reply: '',
})

const submitTopic = (close) => {
	if (!topic.title) {
		toast.error(__('Title cannot be empty.'))
		return
	}
	if (!topic.reply) {
		toast.error(__('Details cannot be empty.'))
		return
	}
	call('frappe.client.insert', {
		doc: {
			doctype: 'Discussion Topic',
			reference_doctype: props.doctype,
			reference_docname: props.docname,
			title: topic.title,
		},
	})
		.then((data) => {
			createReply(data.name, close)
		})
		.catch((err) => {
			toast.error(err.messages?.[0] || err)
			console.error(err)
		})
}

const createReply = (topicName, close) => {
	call('frappe.client.insert', {
		doc: {
			doctype: 'Discussion Reply',
			topic: topicName,
			reply: topic.reply,
		},
	})
		.then((data) => {
			topic.title = ''
			topic.reply = ''
			topics.value.reload()
			capture('discussion_topic_created')
			close()
		})
		.catch((err) => {
			toast.error(err.messages?.[0] || err)
			console.error(err)
		})
}
</script>
