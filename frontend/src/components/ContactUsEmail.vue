<template>
	<Dialog
		v-model="show"
		:options="{
			title: __('Contact Us'),
			size: 'md',
		}"
	>
		<template #body-content>
			<div class="flex flex-col gap-4">
				<FormControl
					v-model="subject"
					:label="__('Subject')"
					type="text"
					:required="true"
				/>
				<div>
					<div class="mb-1.5 text-sm text-ink-gray-5">
						{{ __('Message') }}
						<span class="text-ink-red-3">*</span>
					</div>
					<TextEditor
						:fixedMenu="true"
						@change="(val) => (message = val)"
						editorClass="prose-sm py-2 px-2 min-h-[200px] border-outline-gray-2 hover:border-outline-gray-3 rounded-b-md bg-surface-gray-3"
					/>
				</div>
			</div>
		</template>
		<template #actions="{ close }">
			<div class="pb-5 float-right">
				<Button variant="solid" @click="sendMail(close)">
					{{ __('Send') }}
				</Button>
			</div>
		</template>
	</Dialog>
</template>
<script setup lang="ts">
import { Button, call, Dialog, FormControl, TextEditor, toast } from 'frappe-ui'
import { ref } from 'vue'
import { useSettings } from '@/stores/settings'

const show = defineModel<boolean>({ required: true, default: false })
const subject = ref('')
const message = ref('')
const settingsStore = useSettings()

const sendMail = (close: Function) => {
	call('frappe.core.doctype.communication.email.make', {
		recipients: settingsStore.settings?.data?.contact_us_email,
		subject: subject.value,
		content: message.value,
		send_email: true,
	})
		.then(() => {
			toast.success(__('Email sent successfully'))
			close()
			subject.value = ''
			message.value = ''
		})
		.catch(() => {
			toast.error(__('Failed to send email'))
			close()
		})
}
</script>
