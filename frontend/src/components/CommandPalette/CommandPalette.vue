<template>
	<Dialog v-model="show">
		<template #body> Command Palette </template>
	</Dialog>
</template>
<script setup lang="ts">
import { Dialog } from 'frappe-ui'

const show = defineModel<boolean>({ required: true, default: false })
</script>
