<template>
	<div class="flex flex-wrap items-center justify-center gap-2">
		<Button
			v-if="createLabel"
			variant="solid"
			:label="createLabel"
			:route="route"
			@click="act('create')"
		>
			<template #prefix>
				<span class="lucide-plus size-4" />
			</template>
		</Button>
		<!-- An href makes the Button an anchor that opens in a new tab. -->
		<Button
			v-if="docs"
			variant="subtle"
			:href="safeUrl(docs)"
			:label="__('Read the docs')"
			@click="act('docs')"
		>
			<template #prefix>
				<span class="lucide-book-open size-4" />
			</template>
		</Button>
	</div>
</template>
<script setup lang="ts">
import { Button } from 'frappe-ui'
import { onMounted, watch } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import { useTelemetry } from '@framework/ui/telemetry/index'
import { safeUrl } from '@/utils/safeUrl'

// The buttons under a list's empty state, for people who can fill the list.
// It mounts only while that empty state shows, so mounting is the "shown" event.
const props = defineProps<{
	/** Which list this is, for telemetry, e.g. "batches". */
	list: string
	/** The list's tab, when it has tabs; a tab change counts as a new showing. */
	tab?: string
	createLabel?: string
	/** Navigate on create instead of emitting it. */
	route?: RouteLocationRaw
	docs?: string
}>()

const emit = defineEmits<{ create: [] }>()

const { capture } = useTelemetry()

function track(event: string, extra: Record<string, string> = {}) {
	capture(event, { list: props.list, tab: props.tab ?? '', ...extra })
}

function act(action: 'create' | 'docs') {
	track('list_empty_state_action', { action })
	if (action === 'create' && !props.route) emit('create')
}

onMounted(() => track('list_empty_state_shown'))
watch(
	() => props.tab,
	() => track('list_empty_state_shown')
)
</script>
