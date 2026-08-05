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
							class="-ms-4 !max-w-96 !justify-start !pe-0 text-p-2xl-semibold cursor-pointer hover:bg-transparent hover:opacity-70 focus:bg-transparent focus:outline-none focus:ring-0 active:bg-transparent active:text-ink-gray-5"
							@click="emit('back')"
						/>
						<h2 v-else class="text-p-2xl-semibold text-ink-gray-8">
							{{ title }}
						</h2>
						<slot name="title-badge" />
					</div>
					<p v-if="description" class="text-p-base text-ink-gray-6 max-w-2xl">
						{{ description }}
					</p>
				</div>
				<div
					v-if="$slots['header-actions'] || enabled !== undefined"
					class="flex shrink-0 items-center gap-3"
				>
					<Switch
						v-if="enabled !== undefined"
						v-model="enabled"
						size="sm"
						:label="__('Enabled')"
					/>
					<div v-if="unsaved" class="flex items-center gap-x-1 text-ink-gray-5">
						<span class="lucide-dot size-4" />
						<span class="text-p-sm">{{ __('Not saved') }}</span>
					</div>
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
import { Button, Switch } from 'frappe-ui'

defineProps<{
	title: string
	description?: string
	showBack?: boolean
	/** Marks the record as edited but not yet written. */
	unsaved?: boolean
}>()

const emit = defineEmits<{ back: [] }>()

// A record's own on/off state belongs beside Save, not as the first field in
// the body. Undefined on panels that have no such state, which is what hides it.
const enabled = defineModel<boolean | undefined>('enabled', {
	default: undefined,
})
</script>
