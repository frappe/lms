<template>
	<Dialog
		v-model:open="show"
		title="Make an Announcement"
		size="xl"
		:actions="[
			{
				label: 'Submit',
				variant: 'solid',
				onClick: ({ close }) => makeAnnouncement(close),
			},
		]"
	>
		<template #default>
			<div class="flex flex-col gap-4">
				<FormControl
					:label="__('Subject')"
					type="text"
					v-model="announcement.subject"
					:required="true"
				/>
				<FormControl
					:label="__('Reply To')"
					type="text"
					v-model="announcement.replyTo"
					:required="true"
				/>
				<div class="mb-4 space-y-1.5">
					<InputLabel
						:id="announcementLabelId"
						:label="__('Announcement')"
						:required="true"
					/>
					<RichTextEditor
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
import { Dialog, FormControl, createResource, toast } from 'frappe-ui'
import { reactive, useId } from 'vue'
import { InputLabel } from '@/components/Form/labeling'
import RichTextEditor from '@/components/RichTextEditor.vue'

const announcementLabelId = useId()

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
			recipients: announcement.replyTo,
			bcc: props.students.join(', '),
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
					return __('No students in this batch')
				}
				if (!announcement.subject) {
					return __('Subject is required')
				}
				if (!announcement.announcement) {
					return __('Announcement is required')
				}
				if (!announcement.replyTo) {
					return __('Reply To is required')
				}
			},
			onSuccess() {
				close()
				toast.success(__('Announcement has been sent successfully'))
			},
			onError(err) {
				toast.error(__(err.messages?.[0] || err))
			},
		}
	)
}
</script>
