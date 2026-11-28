<template>
	<div
		v-if="first"
		class="flex min-w-0 items-center gap-2.5 overflow-hidden"
		aria-hidden="true"
	>
		<Skeleton class="size-6 shrink-0 rounded-full" />
		<Skeleton class="h-2 w-28 rounded-full" />
	</div>
	<Skeleton v-else-if="!blank" class="h-2 w-12 rounded-full" />
</template>
<script setup lang="ts">
import { Skeleton } from 'frappe-ui'

defineProps<{ first: boolean; blank?: boolean }>()
</script>
