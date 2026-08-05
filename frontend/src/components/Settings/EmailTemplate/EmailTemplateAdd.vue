<template>
	<SettingsLayout
		:title="isDuplicate ? __('Duplicate Template') : __('New Email Template')"
		:show-back="true"
		@back="emit('update:step', 'template-list')"
	>
		<template #header-actions>
			<Button
				:label="isDuplicate ? __('Duplicate') : __('Create')"
				variant="solid"
				:loading="templates.insert.loading"
				@click="createTemplate"
			/>
		</template>
		<div class="flex flex-col gap-4">
			<FormControl
				v-model="template.name"
				type="text"
				:label="__('Name')"
				:placeholder="__('Batch Enrollment Confirmation')"
				:required="true"
			/>
			<FormControl
				v-model="template.subject"
				type="text"
				:label="__('Subject')"
				:placeholder="__('Your enrollment in {{ batch_name }} is confirmed')"
				:required="true"
			/>
			<Switch
				v-model="template.use_html"
				size="sm"
				:label="__('Use HTML')"
				:description="__('Use HTML content for the email response')"
			/>
			<FormControl
				v-if="template.use_html"
				v-model="template.response_html"
				type="textarea"
				:label="__('Content')"
				:required="true"
				:placeholder="htmlPlaceholder"
			/>
			<div v-else class="space-y-1.5">
				<InputLabel
					:id="contentLabelId"
					:label="__('Content')"
					:required="true"
				/>
				<RichTextEditor
					:content="template.response"
					:editable="true"
					:fixed-menu="true"
					:placeholder="richPlaceholder"
					editor-class="prose-sm max-w-none border-b border-x border-outline-elevation-2 bg-surface-gray-2 rounded-b-md py-1 px-2 min-h-[7rem] max-h-[18rem] overflow-y-auto"
					@change="(val) => (template.response = val)"
				/>
			</div>
			<ErrorMessage v-if="error" class="ms-1" :message="error" />
		</div>
	</SettingsLayout>
</template>

<script setup lang="ts">
import SettingsLayout from '@/components/Layouts/SettingsLayout.vue'
import {
	Button,
	ErrorMessage,
	FormControl,
	Switch,
	createListResource,
	toast,
} from 'frappe-ui'
import { computed, reactive, ref, useId } from 'vue'
import { InputLabel } from '@/components/Form/labeling'
import { cleanError } from '@/utils'
import type { EmailTemplate, EmailTemplateStep } from '@/types'
import RichTextEditor from '@/components/RichTextEditor.vue'

const contentLabelId = useId()

interface P {
	templateData?: EmailTemplate | null
}

interface E {
	(event: 'update:step', step: EmailTemplateStep): void
}

const props = withDefaults(defineProps<P>(), {
	templateData: null,
})

const emit = defineEmits<E>()

const isDuplicate = computed(() => Boolean(props.templateData?.name))

const template = reactive({
	name: props.templateData?.name ? `${props.templateData.name} - Copy` : '',
	subject: props.templateData?.subject || '',
	use_html: Boolean(props.templateData?.use_html),
	response: props.templateData?.response || '',
	response_html: props.templateData?.response_html || '',
})

const htmlPlaceholder = __(
	'<p>Dear {{ member_name }},</p>\n\n<p>You have been enrolled in our upcoming batch {{ batch_name }}.</p>\n\n<p>Thanks,</p>\n<p>Frappe Learning</p>'
)
const richPlaceholder = __(
	'Dear {{ member_name }},\n\nYou have been enrolled in our upcoming batch {{ batch_name }}.\n\nThanks,\nFrappe Learning'
)

const templates = createListResource({
	doctype: 'Email Template',
	cache: 'email-templates',
	auto: false,
})

const error = ref<string | undefined>()

function validate() {
	if (!template.name) return __('Name is required')
	if (!template.subject) return __('Subject is required')
	if (template.use_html && !template.response_html)
		return __('Content is required')
	if (!template.use_html && !template.response) return __('Content is required')
	return ''
}

function createTemplate() {
	// guard against a double-submit from spamming the Create button
	if (templates.insert.loading) return
	error.value = validate()
	if (error.value) return

	templates.insert.submit(
		{
			__newname: template.name,
			name: template.name,
			subject: template.subject,
			use_html: template.use_html ? 1 : 0,
			response: template.response,
			response_html: template.response_html,
		},
		{
			onSuccess: () => {
				toast.success(__('Email Template created successfully'))
				emit('update:step', 'template-list')
			},
			onError: (err: { messages?: string[] }) => {
				error.value =
					cleanError(err.messages?.[0]) || __('Error creating email template')
			},
		}
	)
}
</script>
