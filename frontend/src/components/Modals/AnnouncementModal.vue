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
					<div class="mb-1.5 text-sm text-ink-gray-5">
						{{ __('Subject') }}
						<span class="text-ink-red-3">*</span>
					</div>
					<Input type="text" v-model="announcement.subject" />
				</div>
				<div class="">
					<div class="mb-1.5 text-sm text-ink-gray-5">
						{{ __('Reply To') }}
					</div>
					<Input type="text" v-model="announcement.replyTo" />
				</div>
				<div class="mb-4">
					<div class="mb-1.5 text-sm text-ink-gray-5">
						{{ __('Announcement') }}
					</div>
					<TextEditor
						:fixedMenu="true"
						@change="(val) => (announcement.announcement = val)"
						editorClass="prose-sm py-2 px-2 min-h-[200px] border-outline-gray-2 hover:border-outline-gray-3 rounded-b-md bg-surface-gray-3"
					/>
				</div>
			</div>
		</template>
	</Dialog>
</template>
<script setup>
import { Dialog, Input, TextEditor, createResource } from 'frappe-ui'
import { reactive } from 'vue'
import { showToast } from '@/utils/'

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
				showToast(
					__('Success'),
					__('Announcement has been sent successfully'),
					'check'
				)
			},
			onError(err) {
				showToast(__('Error'), __(err.messages?.[0] || err), 'alert-circle')
			},
		}
	)
}
</script>
