<template>
	<Teleport v-if="isMobile" to="body">
		<Transition
			appear
			:enter-active-class="
				reduceMotion ? '' : 'transition duration-200 ease-out'
			"
			:enter-from-class="reduceMotion ? '' : 'translate-y-4 opacity-0'"
			:enter-to-class="reduceMotion ? '' : 'translate-y-0 opacity-100'"
		>
			<div
				ref="pageRef"
				:data-testid="`${testid}-page`"
				role="dialog"
				aria-modal="true"
				:aria-labelledby="titleId"
				tabindex="-1"
				class="fixed inset-0 z-40 flex flex-col bg-surface-base"
			>
				<header class="header-frame gap-1 pt-safe-0">
					<button
						type="button"
						:data-testid="`${testid}-back`"
						:aria-label="__('Back')"
						class="-ms-3 shrink-0 rounded-4 p-1.5 text-ink-gray-9 transition-colors hover:bg-surface-gray-2"
						@click="emit('close')"
					>
						<span class="lucide-chevron-left size-4 block rtl:rotate-180" />
					</button>
					<slot name="title" :id="titleId">
						<h1 :id="titleId" class="truncate text-lg-medium text-ink-gray-9">
							{{ title }}
						</h1>
					</slot>
					<div
						:data-testid="`${testid}-header-actions`"
						class="ms-auto flex shrink-0 items-center gap-2"
					>
						<slot name="actions" />
					</div>
				</header>

				<div
					:data-testid="`${testid}-body`"
					class="min-h-0 flex-1"
					:class="bodyClass"
				>
					<slot />
				</div>
			</div>
		</Transition>
	</Teleport>
</template>
<script setup lang="ts">
// The phone half of a responsive overlay: a dialog on desktop becomes this
// full-screen page below the breakpoint. Keep it mounted for as long as the
// overlay is open, at every width; it renders nothing on desktop, and staying
// mounted across a resize is what lets it hand focus back on close.
//
// The title is the document's only heading while this is open: inert takes the
// page behind's own <h1> out of the a11y tree. A `title` slot gets the id the
// page is labelled by, and must put it on its heading.
import { nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import { useEventListener, useMediaQuery } from '@vueuse/core'
import { useScreenSize } from '@/utils/composables'
import { useInertBackground } from '@/composables/useInertBackground'
import { focusedElementOwnsLayer, trapTab } from '@/composables/useFocusTrap'

// `bodyClass` replaces the scrolling, padded body for content that lays out
// and scrolls its own panes. `testid` prefixes the parts' data-testids.
withDefaults(
	defineProps<{
		title?: string
		bodyClass?: string
		testid?: string
	}>(),
	{
		title: '',
		bodyClass: 'overflow-y-auto overscroll-contain px-5 py-4',
		testid: 'mobile',
	}
)

const emit = defineEmits<{ close: [] }>()

// The transition wraps the teleported node and must never move onto
// <router-view>: a transform on any ancestor would establish a containing block
// for `fixed` (see the Teleport note below).
//
// Enter only. A leave animation needs the page to outlive its own route change,
// and browser-back would hard-cut regardless.
const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)')

const { isMobile } = useScreenSize()
const titleId = useId()
const pageRef = ref<HTMLElement | null>(null)

// Alongside the Tab cycle below, not instead of it. `inert` on #app cannot
// reach the overlays that sit beside #app in <body>, and it cannot express the
// popover deferral the cycle carries; what it adds is the background leaving
// the a11y tree, find-in-page and pointer hit-testing, none of which a keydown
// handler can do. `aria-modal` stays too — it is what makes a screen reader
// announce this as a modal dialog, which inert does not.
useInertBackground(isMobile)

// Teleporting to body is load-bearing, not a11y hygiene: `fixed inset-0` only
// escapes to the viewport because no ancestor establishes a containing block
// for `fixed`, and any layout ancestor gaining a transform/filter/will-change
// would silently reparent this overlay back into main#scrollContainer.
//
// The Escape handler is guarded on isMobile so it never double-fires alongside
// the desktop Dialog's own (frappe-ui-internal) Escape handling.
//
// Tab is trapped because `aria-modal="true"` tells a screen reader the page
// behind is not there but does not stop Tab reaching it: this page is last in
// <body>, so Tab off its final stop wraps round into the page behind. The trap
// lives in useFocusTrap, shared with BottomSheet.
useEventListener(document, 'keydown', (e: KeyboardEvent) => {
	if (!isMobile.value) return
	if (e.key === 'Escape') {
		// A held Escape would otherwise spend the first press dismissing the
		// popover and close the page on the second, from one key the user
		// never released. Escape also cancels an IME candidate window, which
		// is OS chrome and renders no layer to defer to.
		if (e.repeat || e.isComposing || e.defaultPrevented) return
		if (focusedElementOwnsLayer()) return
		emit('close')
		return
	}
	if (e.key !== 'Tab') return
	trapTab(e, pageRef.value)
})

// Guarded on `tookFocus`, not on `isMobile`: useScreenSize is resize-driven, so
// crossing the breakpoint while the page is open unrenders it and destroys
// whichever node held focus. Reading isMobile at unmount would then skip the
// restore entirely.
let previouslyFocused: HTMLElement | null = null
let tookFocus = false

// Same opt-in as frappe-ui's Dialog (useAutofocusOnOpen), so one `autofocus`
// on a field works at both widths. Content without one keeps the container.
const seatFocus = (): void => {
	const marked = pageRef.value?.querySelector<HTMLElement>('[autofocus]')
	marked?.focus()
	if (!marked || document.activeElement !== marked) pageRef.value?.focus()
}

onMounted(() => {
	if (!isMobile.value) return
	previouslyFocused = document.activeElement as HTMLElement | null
	tookFocus = true
	seatFocus()
})

// Re-seat focus across that swap; the desktop Dialog seats its own.
watch(isMobile, async (mobile) => {
	if (!tookFocus || !mobile) return
	await nextTick()
	seatFocus()
})

// The trigger usually survives, but a save that reloads a list re-renders its
// rows, so the captured node is replaced. focus() on a detached node is a
// silent no-op that leaves the user on <body>, and so is focusing <body>
// itself, which is what activeElement reads as when nothing had focus.
// main#scrollContainer already carries tabindex="-1" and is already the
// skip-link target, so it is the sanctioned landing spot rather than a new one.
//
// reka's own FocusScope restore runs in a setTimeout(0) after this, but it
// targets a node inside the overlay being removed, so it lands on nothing.
onBeforeUnmount(() => {
	if (!tookFocus) return
	const target = previouslyFocused
	previouslyFocused = null
	if (target?.isConnected && target !== document.body) {
		target.focus()
		return
	}
	document.getElementById('scrollContainer')?.focus()
})
</script>
