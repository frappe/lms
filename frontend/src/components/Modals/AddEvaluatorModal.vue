<template>
	<Dialog
		v-model="show"
		:options="{
			title: __('Add Existing User as Evaluator'),
			size: 'md',
			actions: [
				{
					label: __('Add'),
					variant: 'solid',
					loading: submitting,
					onClick: ({ close }: any) => addEvaluator(close),
				},
			],
		}"
	>
		<template #body-content>
			<Link doctype="User" v-model="selectedUser" :label="__('Select User')" />
		</template>
	</Dialog>
</template>

<script setup lang="ts">
import { call, Dialog, toast } from 'frappe-ui'
import { ref, watch } from 'vue'
import { cleanError } from '@/utils'
import Link from '@/components/Controls/Link.vue'

const show = defineModel<boolean>({ default: false })
const selectedUser = ref('')
const submitting = ref(false)

const emit = defineEmits<{
	added: []
}>()

watch(show, (isOpen) => {
	if (isOpen) {
		selectedUser.value = ''
	}
})

const addEvaluator = async (close?: () => void) => {
	if (!selectedUser.value?.trim()) {
		toast.error(__('Please select a user'))
		return
	}

	submitting.value = true
	try {
		await call('lms.lms.api.save_role', {
			user: selectedUser.value,
			role: 'Batch Evaluator',
			value: 1,
		})
		toast.success(__('Evaluator added successfully'))
		emit('added')
		close?.()
	} catch (err: any) {
		toast.error(cleanError(err.messages?.[0]) || __('Unable to add evaluator'))
	} finally {
		submitting.value = false
	}
}
</script>
