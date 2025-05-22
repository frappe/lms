<template>
	<Dialog
		v-model="show"
		:options="{
			title:
				templateID == 'new'
					? __('New Email Template')
					: __('Edit Email Template'),
			size: 'lg',
			actions: [
				{
					label: __('Save'),
					variant: 'solid',
					onClick: ({ close }) => {
						saveTemplate(close)
					},
				},
			],
		}"
	>
		<template #body-content>
			<div class="space-y-4">
				<FormControl
					:label="__('Name')"
					v-model="template.name"
					type="text"
					:required="true"
				/>
				<FormControl
					:label="__('Subject')"
					v-model="template.subject"
					type="text"
					:required="true"
				/>
				<FormControl
					:label="__('Use HTML')"
					v-model="template.use_html"
					type="checkbox"
				/>
				<div>
					<div class="text-xs text-ink-gray-5 mb-2">
						{{ __('Response') }}
						<span class="text-ink-red-3">*</span>
					</div>
					<TextEditor
						:content="template.response"
						@change="(val) => (template.response = val)"
						:editable="true"
						:fixedMenu="true"
						editorClass="prose-sm max-w-none border-b border-x bg-surface-gray-2 rounded-b-md py-1 px-2 min-h-[7rem] max-h-[18rem] overflow-y-auto"
					/>
				</div>
			</div>
		</template>
	</Dialog>
</template>
<script setup lang="ts">
import { Dialog, FormControl, TextEditor, toast } from 'frappe-ui'
import { reactive, ref, watch } from 'vue'
import { cleanError } from '@/utils'

const props = defineProps({
	templateID: {
		type: String,
		default: 'new',
	},
})

console.log(props.templateID)

const show = defineModel()
const emailTemplates = defineModel('emailTemplates')
const template = reactive({
	name: '',
	subject: '',
	use_html: false,
	response: '',
})

const saveTemplate = (close) => {
	if (props.templateID == 'new') {
		createNewTemplate(close)
	} else {
		updateTemplate(close)
	}
}

const createNewTemplate = (close) => {
	emailTemplates.value.insert.submit(
		{
			__newname: template.value.name,
			...template.value,
		},
		{
			onSuccess() {
				emailTemplates.value.reload()
				close()
				refreshForm()
				toast.success(__('Email Template created successfully'))
			},
			onError(err) {
				close()
				refreshForm()
				toast.error(
					cleanError(err.messages[0]) || __('Error creating email template')
				)
			},
		}
	)
}

const updateTemplate = (close) => {
	console.log(show)
	emailTemplates.value.setValue.submit({
		name: props.templateID,
		...template,
	}),
		{
			onSuccess() {
				emailTemplates.value.reload()
				close()
				refreshForm()
				toast.success(__('Email Template updated successfully'))
			},
			onError(err) {
				close()
				refreshForm()
				toast.error(
					cleanError(err.messages[0]) || __('Error updating email template')
				)
			},
		}
}

watch(
	() => props.templateID,
	(val) => {
		if (val !== 'new') {
			emailTemplates.value?.data.forEach((row) => {
				if (row.name === val) {
					template.name = row.name
					template.subject = row.subject
					template.use_html = row.use_html
					template.response = row.response
				}
			})
		}
	},
	{ flush: 'post' }
)

const refreshForm = () => {
	template.name = ''
	template.subject = ''
	template.use_html = false
	template.response = ''
}
</script>
