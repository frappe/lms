<template>
	<div v-if="step === 'template-list'" class="h-full">
		<EmailTemplateList :label="label" @update:step="updateStep" />
	</div>
	<div v-else-if="step === 'template-new'" class="h-full">
		<EmailTemplateAdd
			:template-data="selectedTemplate"
			@update:step="updateStep"
		/>
	</div>
	<div v-else-if="step === 'template-edit'" class="h-full">
		<EmailTemplateEdit
			:template-data="selectedTemplate"
			@update:step="updateStep"
		/>
	</div>
</template>

<script setup lang="ts">
import { Ref, ref } from 'vue'
import EmailTemplateList from './EmailTemplateList.vue'
import EmailTemplateAdd from './EmailTemplateAdd.vue'
import EmailTemplateEdit from './EmailTemplateEdit.vue'
import type { EmailTemplate, EmailTemplateStep } from '@/types/email'

defineProps<{
	label: string
	description?: string
}>()

const step: Ref<EmailTemplateStep> = ref('template-list')
const selectedTemplate = ref<EmailTemplate | null>(null)

function updateStep(newStep: EmailTemplateStep, data?: EmailTemplate) {
	step.value = newStep
	selectedTemplate.value = data ?? null
}
</script>
