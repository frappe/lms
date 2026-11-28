<template>
	<EmptyStateLayout
		role="alert"
		name="Error"
		:compact="compact"
		:icon="copy.icon"
		:title="copy.title"
		:description="copy.description"
	>
		<Button
			v-if="canRetry(kind)"
			:label="__('Retry')"
			:size="compact ? 'sm' : 'md'"
			@click="emit('retry')"
		>
			<template #prefix>
				<span class="lucide-rotate-cw size-4" aria-hidden="true" />
			</template>
		</Button>
	</EmptyStateLayout>
</template>
<script setup lang="ts">
import { Button } from 'frappe-ui'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import EmptyStateLayout from '@/components/Layouts/EmptyStateLayout.vue'
import { canRetry, loadErrorKind } from '@/utils/loadError'
import type { LoadErrorKind } from '@/utils/loadError'

const props = defineProps<{
	error: unknown
	compact?: boolean
}>()

const emit = defineEmits<{ retry: [] }>()

const online = ref(navigator.onLine)
const kind = computed<LoadErrorKind>(() =>
	loadErrorKind(props.error, online.value)
)

const COPY = (): Record<
	LoadErrorKind,
	{ icon: string; title: string; description: string }
> => ({
	offline: {
		icon: 'lucide-wifi-off',
		title: __('You are offline'),
		description: __('This loads again once you are back online.'),
	},
	unreachable: {
		icon: 'lucide-cloud-off',
		title: __('Could not reach the server'),
		description: __('Check your connection and try again.'),
	},
	denied: {
		icon: 'lucide-lock',
		title: __('You do not have access to this'),
		description: __('Ask a moderator for access if you need it.'),
	},
	missing: {
		icon: 'lucide-search-x',
		title: __('This no longer exists'),
		description: __('It may have been deleted or renamed.'),
	},
	busy: {
		icon: 'lucide-hourglass',
		title: __('The server is busy'),
		description: __('Wait a moment and try again.'),
	},
	server: {
		icon: 'lucide-circle-alert',
		title: __('Failed to load'),
		description: __('Something went wrong on the server. Try again.'),
	},
})

const copy = computed(() => COPY()[kind.value])

// Back online after a network failure: load again without making them click.
const onOnline = (): void => {
	const wasNetwork = kind.value === 'offline' || kind.value === 'unreachable'
	online.value = true
	if (wasNetwork) emit('retry')
}
const onOffline = (): void => {
	online.value = false
}

onMounted(() => {
	window.addEventListener('online', onOnline)
	window.addEventListener('offline', onOffline)
})
onBeforeUnmount(() => {
	window.removeEventListener('online', onOnline)
	window.removeEventListener('offline', onOffline)
})
</script>
