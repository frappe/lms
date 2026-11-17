<template>
	<div
		role="status"
		:aria-label="__('Loading...')"
		data-testid="modal-loading"
		class="flex items-center justify-center py-12"
	>
		<LoadingIndicator class="size-5 text-ink-gray-5" />
	</div>
</template>
<script setup lang="ts">
// The default loading state for a modal: one centred spinner. A modal that
// wants a skeleton renders its own in place of this.
import { LoadingIndicator } from 'frappe-ui'
</script>
