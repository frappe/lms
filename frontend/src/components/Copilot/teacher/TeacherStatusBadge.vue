<template>
	<Badge
		v-if="status"
		variant="subtle"
		:theme="statusTheme(status)"
		:label="statusLabel(status)"
	/>
</template>

<script setup>
import { Badge } from 'frappe-ui'
import { statusLabel, statusTheme } from './format'

defineProps({
	status: { type: String, default: '' },
})
</script>
