<template>
	<Tooltip v-if="isMobile && icon" :text="label">
		<Button
			:variant="variant"
			:theme="theme"
			:loading="loading"
			:disabled="disabled"
			:label="label"
			@click="emit('click')"
		>
			<template #icon>
				<span :class="[icon, 'size-4']" />
			</template>
		</Button>
	</Tooltip>
	<Button
		v-else
		:variant="variant"
		:theme="theme"
		:loading="loading"
		:disabled="disabled"
		@click="emit('click')"
	>
		<template v-if="icon" #prefix>
			<span :class="[icon, 'size-4']" />
		</template>
		{{ label }}
	</Button>
</template>

<script setup lang="ts">
import { Button, Tooltip } from 'frappe-ui'
import { useScreenSize } from '@/utils/composables'

// `icon` is optional, and omitting it is the whole way to get a word rather
// than a glyph on a phone: with no icon there is nothing to collapse to, so the
// labelled button renders at both breakpoints and the Tooltip is dropped (the
// label is already on screen, and a tooltip that repeats visible text is noise).
//
// No size override on either branch, at the user's direction: every header
// button is frappe-ui's `sm`, 28px, at every width. This replaced a `!size-9` /
// `!h-auto !min-h-9` pair that gave phones a 36px touch target. 28px still
// clears WCAG 2.5.8's 24px minimum, so restoring the floor is a preference and
// not a fix - do not reinstate it without asking. What the pair also bought,
// and what is now gone: `!h-auto` let a label grow past the fixed `h-7` under
// text-only zoom, which `truncate` inside `h-7` otherwise clips (WCAG 1.4.4).
withDefaults(
	defineProps<{
		label: string
		icon?: string
		variant?: 'solid' | 'subtle' | 'outline' | 'ghost'
		theme?: 'gray' | 'blue' | 'green' | 'red'
		loading?: boolean
		disabled?: boolean
	}>(),
	{
		variant: 'outline',
		theme: 'gray',
		loading: false,
		disabled: false,
	}
)

const emit = defineEmits<{ (e: 'click'): void }>()

const { isMobile } = useScreenSize()
</script>
