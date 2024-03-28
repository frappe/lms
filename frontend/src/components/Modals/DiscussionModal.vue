<template>
	<Dialog
		:options="{
			title: props.title,
			size: '2xl',
			actions: [
				{
					label: 'Submit',
					variant: 'solid',
					onClick: (close) => submitTopic(close),
				},
			],
		}"
	>
		<template #body-content>
			<div class="flex flex-col gap-4">
				<div>
					<div class="mb-1.5 text-sm text-gray-600">
						{{ __('Title') }}
					</div>
					<Input type="text" v-model="topic.title" />
				</div>
				<div>
					<div class="mb-1.5 text-sm text-gray-600">
						{{ __('Details') }}
					</div>
					<TextEditor
						:content="topic.reply"
						@change="(val) => (topic.reply = val)"
						:editable="true"
						:fixedMenu="true"
						editorClass="prose-sm max-w-none border-b border-x bg-gray-100 rounded-b-md py-1 px-2 min-h-[7rem]"
					/>
				</div>
			</div>
		</template>
	</Dialog>
</template>
<script setup>
import { Dialog, Input, TextEditor, createResource } from 'frappe-ui'
import { reactive, defineModel } from 'vue'

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
		}
	)
}
</script>
