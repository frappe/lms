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
						editorClass="prose-sm max-w-none border-b border-x bg-surface-gray-2 rounded-b-md py-1 px-2 min-h-[7rem]"
					/>
				</div>
			</div>
		</template>
	</Dialog>
</template>
<script setup>
import {
	Dialog,
	FormControl,
	TextEditor,
	createResource,
	toast,
} from 'frappe-ui'
import { reactive } from 'vue'
import { singularize } from '@/utils'

const topics = defineModel('reloadTopics')

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

const topicResource = createResource({
	url: 'frappe.client.insert',
	makeParams(values) {
		return {
			doc: {
				doctype: 'Discussion Topic',
				reference_doctype: props.doctype,
				reference_docname: props.docname,
				title: topic.title,
			},
		}
	},
})

const replyResource = createResource({
	url: 'frappe.client.insert',
	makeParams(values) {
		return {
			doc: {
				doctype: 'Discussion Reply',
				topic: values.topic,
				reply: topic.reply,
			},
		}
	},
})

const submitTopic = (close) => {
	topicResource.submit(
		{},
		{
			validate() {
				if (!topic.title) {
					return 'Title cannot be empty.'
				}
				if (!topic.reply) {
					return 'Reply cannot be empty.'
				}
			},
			onSuccess(data) {
				replyResource.submit(
					{
						topic: data.name,
					},
					{
						onSuccess() {
							topic.title = ''
							topic.reply = ''
							topics.value.reload()
							close()
						},
					}
				)
			},
			onError(err) {
				toast.error(err.messages?.[0] || err)
			},
		}
	)
}
</script>
