<template>
	<Tooltip :text="tooltip">
		<span
			tabindex="0"
			class="inline-flex rounded focus-visible:focus-ring"
			data-testid="unsaved-badge"
		>
			<Badge variant="subtle" theme="amber">{{ label }}</Badge>
		</span>
	</Tooltip>
</template>

<script setup lang="ts">
import { Badge, Tooltip } from 'frappe-ui'
import { computed } from 'vue'

// The settings header's "Not saved" marker, for a record not written yet. The
// tooltip names what saving still needs, or how to save once nothing is missing.
const props = defineProps<{
	/** Translated noun phrases, e.g. __('a title'). */
	missing: string[]
	hint: string
}>()

const label = __('Not saved')

const listFormat = new Intl.ListFormat(document.documentElement.lang || 'en', {
	style: 'long',
	type: 'conjunction',
})

const tooltip = computed<string>(() =>
	props.missing.length
		? __('Add {0} to save').format(listFormat.format(props.missing))
		: props.hint
)
</script>
