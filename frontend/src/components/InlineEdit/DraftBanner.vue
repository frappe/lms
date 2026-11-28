<template>
	<div v-if="!dismissed" class="px-5 pt-5">
		<Alert
			icon="lucide-pencil"
			:title="title"
			:description="description"
			dismissible
			@dismiss="dismissed = true"
		/>
	</div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Alert } from 'frappe-ui'

/** Tells an instructor a new page is the learner's page, editable in place. */
defineProps<{ title: string; description: string }>()

const dismissed = ref<boolean>(false)
</script>
