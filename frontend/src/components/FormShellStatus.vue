<template>
	<div
		v-if="loading"
		role="status"
		:aria-label="__('Loading...')"
		data-testid="form-shell-loading"
	>
		<LoadingIndicator class="size-5 text-ink-gray-5" />
	</div>
	<p v-else data-testid="form-shell-message" class="text-base text-ink-gray-6">
		{{ message }}
	</p>
</template>
<script setup lang="ts">
import { LoadingIndicator } from 'frappe-ui'

defineProps<{ loading: boolean; message: string | null }>()
</script>
