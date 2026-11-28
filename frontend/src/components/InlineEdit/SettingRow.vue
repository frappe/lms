<template>
	<div class="py-3.5">
		<!-- The control drops below the label when both don't fit on one line. -->
		<div class="flex flex-wrap items-center gap-x-6 gap-y-2">
			<div class="min-w-0 grow basis-48">
				<div
					class="text-base-medium"
					:class="danger ? 'text-ink-red-6' : 'text-ink-gray-9'"
				>
					{{ label }}
				</div>
				<div v-if="summary" class="mt-0.5 text-p-sm text-ink-gray-6">
					{{ summary }}
				</div>
			</div>
			<div v-if="$slots.control" class="min-w-0 max-w-full shrink-0">
				<slot name="control" />
			</div>
		</div>
		<div v-if="$slots.default" class="mt-3">
			<slot />
		</div>
	</div>
</template>

<script setup lang="ts">
/** One row in a settings box: label, one-line summary, control on the end. */
defineProps<{ label: string; summary?: string; danger?: boolean }>()
</script>
