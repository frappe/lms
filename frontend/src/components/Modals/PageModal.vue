<template>
	<Dialog
		v-model="show"
		class="text-base"
		:options="{
			title: __('Apply for this job'),
			size: 'lg',
			actions: [
				{
					label: 'Submit',
					variant: 'solid',
					onClick: (close) => {
						submitResume(close)
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
</script>
