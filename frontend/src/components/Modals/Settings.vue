<template>
	<Dialog
		v-model="show"
		:options="{
			title: __('Settings'),
			size: 'xl',
			actions: [
				{
					label: 'Save',
					variant: 'solid',
					onClick: (close) => {
						saveSettings(close)
					},
				},
			],
		}"
	>
		<template #body-content> </template>
	</Dialog>
</template>
<script setup>
import { Dialog } from 'frappe-ui'

const show = defineModel()
</script>
