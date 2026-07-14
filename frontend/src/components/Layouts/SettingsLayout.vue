<template>
	<div class="flex h-full min-h-0 flex-col">
		<header class="shrink-0 p-8 pb-0">
			<div class="flex items-start justify-between gap-4">
				<div class="flex min-w-0 flex-col gap-1">
					<div class="flex items-center gap-2">
						<!-- On a sub-page the title itself is the back control (CRM's
						     EditEmailTemplate): no hover surface, just a chevron and the
						     title, pulled left so the label keeps the header's left edge. -->
						<Button
							v-if="showBack"
							variant="ghost"
							size="md"
							icon-left="lucide-chevron-left"
							:label="title"
							class="-ml-4 !max-w-96 !justify-start !pr-0 text-2xl-semibold cursor-pointer hover:bg-transparent hover:opacity-70 focus:bg-transparent focus:outline-none focus:ring-0 active:bg-transparent active:text-ink-gray-5"
							@click="emit('back')"
						/>
						<h2 v-else class="text-2xl-semibold text-ink-gray-8">
							{{ title }}
						</h2>
						<slot name="title-badge" />
					</div>
					<p v-if="description" class="text-p-base text-ink-gray-6 max-w-2xl">
						{{ description }}
					</p>
				</div>
				<div
					v-if="$slots['header-actions']"
					class="flex shrink-0 items-center gap-2"
				>
					<slot name="header-actions" />
				</div>
			</div>

			<div v-if="$slots['header-bottom']" class="mt-4">
				<slot name="header-bottom" />
			</div>
		</header>

		<div class="flex min-h-0 flex-1 flex-col overflow-y-auto p-8 pt-4">
			<slot />
		</div>
	</div>
</template>

<script setup lang="ts">
import { Button } from 'frappe-ui'

defineProps<{
	title: string
	description?: string
	showBack?: boolean
}>()

const emit = defineEmits<{ back: [] }>()
</script>
