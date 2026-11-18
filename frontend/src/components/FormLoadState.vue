<template>
	<div ref="region" tabindex="-1" class="flex flex-col outline-none">
		<span v-if="!failed" role="status" class="sr-only">{{ __('Loading') }}</span>
		<div v-if="failed" class="grid flex-1 place-items-center px-4 py-6 text-center">
			<div class="space-y-2">
				<div role="status">
					<p class="text-p-base font-medium text-ink-gray-9">{{ __('Failed to load') }}</p>
					<p class="mt-1 text-p-sm text-ink-gray-6">
						{{ __('Could not load this form. Please try again.') }}
					</p>
				</div>
				<Button :label="__('Retry')" icon-left="lucide-refresh-cw" @click="retry" />
			</div>
		</div>
		<div v-else class="flex flex-1 flex-col gap-4 motion-safe:animate-pulse" aria-hidden="true">
			<div
				class="grid grid-cols-1 gap-4"
				:class="kind === 'live-class' ? 'md:grid-cols-2' : undefined"
			>
				<div v-for="field in fields" :key="field" class="space-y-1.5">
					<div class="h-3 w-20 rounded-4 bg-surface-gray-3" />
					<div class="h-7 rounded-4 bg-surface-gray-2" />
				</div>
			</div>
			<div v-if="kind === 'announcement' || kind === 'live-class'" class="space-y-1.5">
				<div class="h-3 w-24 rounded-4 bg-surface-gray-3" />
				<div
					class="rounded-5 bg-surface-gray-2"
					:class="kind === 'announcement' ? 'h-60' : 'h-12'"
				/>
			</div>
			<div v-if="kind === 'enrollment'" class="flex flex-1 flex-col items-center justify-center gap-2">
				<div class="mb-1 size-6 rounded-full bg-surface-gray-2" />
				<div class="h-3 w-28 rounded-4 bg-surface-gray-3" />
				<div class="h-3 w-44 rounded-4 bg-surface-gray-2" />
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { Button } from 'frappe-ui'
import { computed, ref } from 'vue'

const props = defineProps<{
	kind: 'enrollment' | 'announcement' | 'live-class' | 'certificates'
	failed?: boolean
}>()

const emit = defineEmits<{ retry: [] }>()
const fields = computed(() => {
	if (props.kind === 'enrollment') return 1
	if (props.kind === 'live-class') return 2
	if (props.kind === 'certificates') return 3
	return 2
})

const region = ref<HTMLElement | null>(null)
const retry = () => {
	region.value?.focus()
	emit('retry')
}
</script>
