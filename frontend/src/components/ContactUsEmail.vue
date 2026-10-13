<template>
	<Dialog v-model:open="show" :title="__('Contact Us')" size="md">
		<template #default>
			<div class="flex flex-col gap-4">
				<FormControl
					v-model="subject"
					:label="__('Subject')"
					type="text"
					:required="true"
				/>
				<div class="space-y-1.5">
					<InputLabel
						:id="messageLabelId"
						:label="__('Message')"
						:required="true"
					/>
					<RichTextEditor
						:fixedMenu="true"
						@change="(val) => (message = val)"
						editorClass="prose-sm py-2 px-2 min-h-[200px] border-outline-gray-2 hover:border-outline-gray-3 rounded-b-md bg-surface-gray-3"
					/>
				</div>
			</div>
		</template>
		<template #actions="{ close }">
			<div class="pb-5 float-end">
				<Button variant="solid" @click="sendMail(close)">
					{{ __('Send') }}
				</Button>
			</div>
		</template>
	</Dialog>
</template>
<script setup lang="ts">
import { Button, call, Dialog, FormControl, toast } from 'frappe-ui'
import { ref, useId } from 'vue'
import { InputLabel } from '@/components/Form/labeling'
import { resourceErrorMessage } from '@/utils/resource'
import RichTextEditor from '@/components/RichTextEditor.vue'

const messageLabelId = useId()

const show = defineModel<boolean>({ required: true, default: false })
const subject = ref('')
const message = ref('')

/* Sent server-side so the recipient comes from LMS Settings rather than the
   request, and so an image pasted into the message is embedded into the mail
   itself. Its upload is private, and a /private/files/ URL in an email is
   served to nobody. */
const sendMail = (close: Function) => {
	call('lms.lms.api.send_contact_us_email', {
		subject: subject.value,
		content: message.value,
	})
		.then(() => {
			toast.success(__('Email sent successfully'))
			close()
			subject.value = ''
			message.value = ''
		})
		.catch((error: unknown) => {
			// The dialog stays open: the message is worth keeping when the
			// failure is something the sender can fix.
			toast.error(resourceErrorMessage(error, __('Failed to send email')))
		})
}
</script>
