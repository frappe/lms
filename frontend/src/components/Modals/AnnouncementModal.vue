<template>
	<Dialog
		v-model="show"
		:options="{
			title: __('Make an Announcement'),
			size: 'xl',
			actions: [
				{
					label: 'Submit',
					variant: 'solid',
					onClick: (close) => makeAnnouncement(close),
				},
			],
		}"
	>
		<template #body-content>
			<div class="flex flex-col gap-4">
				<div class="">
					<div class="mb-1.5 text-sm text-gray-600">
						{{ __('Subject') }}
					</div>
					<Input type="text" v-model="announcement.subject" />
				</div>
				<div class="">
					<div class="mb-1.5 text-sm text-gray-600">
						{{ __('Reply To') }}
					</div>
					<Input type="text" v-model="announcement.replyTo" />
				</div>
				<div class="mb-4">
					<div class="mb-1.5 text-sm text-gray-600">
						{{ __('Announcement') }}
					</div>
					<TextEditor
						:bubbleMenu="true"
						@change="(val) => (announcement.announcement = val)"
						editorClass="prose-sm py-2 px-2 min-h-[200px] border-gray-300 hover:border-gray-400 rounded-md bg-gray-200"
					/>
				</div>
			</div>
		</template>
	</Dialog>
</template>
<script setup>
import { Dialog, Input, TextEditor, createResource } from 'frappe-ui'
import { reactive } from 'vue'
import { createToast } from '@/utils/'

const show = defineModel()

const props = defineProps({
	batch: {
		type: String,
		required: true,
	},
	students: {
		type: Array,
		required: true,
	},
})

const announcement = reactive({
	subject: '',
	replyTo: '',
	announcement: '',
})

const announcementResource = createResource({
	url: 'frappe.core.doctype.communication.email.make',
	makeParams(values) {
		return {
			recipients: props.students.join(', '),
			cc: announcement.replyTo,
			subject: announcement.subject,
			content: announcement.announcement,
			doctype: 'LMS Batch',
			name: props.batch,
			send_email: 1,
		}
	},
})

const makeAnnouncement = (close) => {
	announcementResource.submit(
		{},
		{
			validate() {
				if (!props.students.length) {
					return 'No students in this batch'
				}
				if (!announcement.subject) {
					return 'Subject is required'
				}
			},
			onSuccess() {
				close()
				createToast({
					title: 'Success',
					text: 'Announcement has been sent successfully',
					icon: 'Check',
					iconClasses: 'bg-green-600 text-white rounded-md p-px',
				})
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
</script>
