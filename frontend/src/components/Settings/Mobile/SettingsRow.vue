<template>
	<component
		:is="tag"
		:type="tag === 'button' ? 'button' : undefined"
		:aria-label="tag === 'button' ? label : undefined"
		:href="safeUrl(href)"
		:target="opensInNewTab ? '_blank' : undefined"
		:rel="opensInNewTab ? 'noopener noreferrer' : undefined"
		class="flex min-h-12 w-full items-center gap-3 border-b border-outline-gray-1 px-3.5 py-2 text-start last:border-b-0"
		@click="tag === 'button' ? emit('click') : undefined"
	>
		<span
			v-if="icon"
			:class="[icon, 'size-4.5 shrink-0 text-ink-gray-7']"
			aria-hidden="true"
		/>
		<span class="flex min-w-0 flex-1 flex-col gap-0.5">
			<span class="truncate text-p-base text-ink-gray-9">{{ label }}</span>
			<span v-if="opensInNewTab" class="sr-only">{{ newTabHint }}</span>
			<span v-if="description" class="text-p-xs text-ink-gray-6">
				{{ description }}
			</span>
		</span>
		<span v-if="value" class="shrink-0 text-p-sm text-ink-gray-6">
			{{ value }}
		</span>
		<slot name="control" />
		<span
			v-if="opensInNewTab"
			class="lucide-external-link size-4.5 shrink-0 text-ink-gray-5"
			aria-hidden="true"
		/>
		<span
			v-else-if="tag !== 'div' && chevron"
			class="lucide-chevron-right size-4.5 shrink-0 text-ink-gray-5"
			aria-hidden="true"
		/>
	</component>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { safeUrl } from '@/utils/safeUrl'

// A single row of the inset-grouped settings list.
//
// The tag follows the shape rather than being a prop the caller can get wrong:
// off-SPA is an <a>, in-SPA navigation is a <button> with a chevron, and a row
// carrying its own control is a <div> — the control is already the interactive
// element, and a button inside a button is invalid.
//
// A real <a>, not a button calling `window.open`, so it reaches the links rotor
// and keeps middle-click, long-press and copy-link-address. Its "opens in a new
// tab" note is an `sr-only` span because an <a> takes its name from contents;
// the same span inside the <button> shape would be dropped, since `aria-label`
// outranks name-from-contents.
//
// `chevron: false` keeps the button and drops the affordance, for a row that
// commits a choice in place — the colour-mode options.
//
// The label is deliberately regular weight, matching Gameplan rather than
// ResponsiveListView's `text-p-base-medium` card title. The two were aligned
// once and reverted on sight; do not re-bold it.
const props = withDefaults(
	defineProps<{
		label: string
		description?: string
		icon?: string
		value?: string
		// Outside the SPA. Wins over `navigates`: the browser does the going,
		// so there is nothing for a click handler to do.
		href?: string
		navigates?: boolean
		chevron?: boolean
	}>(),
	{ navigates: false, chevron: true }
)

const emit = defineEmits<{ click: [] }>()

// The shape follows the URL that will actually be rendered, not the one passed
// in: a rejected scheme drops the attribute, and an <a> without href still takes
// focus and announces as a link.
const safeHref = computed(() => safeUrl(props.href))

const tag = computed(() =>
	safeHref.value ? 'a' : props.navigates ? 'button' : 'div'
)

// Off this site, so a new tab: coming back is the phone's back gesture
// otherwise, and it would have unloaded the app. A path this site serves itself
// stays in the tab, the way the desktop sidebar sends one.
const opensInNewTab = computed(() => /^https?:\/\//i.test(safeHref.value || ''))

const newTabHint = __('(opens in a new tab)')
</script>
