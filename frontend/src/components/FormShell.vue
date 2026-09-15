<template>
	<Dialog
		v-if="!isMobile"
		:open="true"
		:title="title"
		:size="size"
		@update:open="onDialogToggle"
	>
		<template #title>
			<div class="flex flex-1 items-center justify-between gap-2">
				<h3 class="text-2xl-semibold leading-6 text-ink-gray-8">
					{{ title }}
				</h3>
				<slot name="header-action" />
			</div>
		</template>
		<template #default>
			<slot />
		</template>
		<template #actions>
			<slot name="actions" />
		</template>
	</Dialog>

	<Teleport v-else to="body">
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
				data-testid="form-shell-page"
				role="dialog"
				aria-modal="true"
				:aria-labelledby="titleId"
				tabindex="-1"
				class="fixed inset-0 z-40 flex flex-col bg-surface-base"
			>
				<header class="header-frame gap-1 pt-safe-0">
					<button
						type="button"
						data-testid="form-shell-back"
						:aria-label="__('Back')"
						class="-ms-3 shrink-0 rounded p-1.5 text-ink-gray-9 transition-colors hover:bg-surface-gray-2"
						@click="emit('close')"
					>
						<span class="lucide-chevron-left size-4 block" />
					</button>
					<h1 :id="titleId" class="truncate text-lg-medium text-ink-gray-9">
						{{ title }}
					</h1>
					<div
						data-testid="form-shell-header-actions"
						class="ms-auto flex shrink-0 items-center gap-2"
					>
						<slot name="header-action" />
						<slot name="actions" />
					</div>
				</header>

				<div
					data-testid="form-shell-body"
					class="flex-1 overflow-y-auto overscroll-contain px-5 py-4"
				>
					<slot />
				</div>
			</div>
		</Transition>
	</Teleport>
</template>
<script setup lang="ts">
// The title is the document's only heading while this is open: inert takes the
// list page's own <h1> out of the a11y tree.
//
// `actions` renders in the header on mobile and in the Dialog's footer on
// desktop. Pass HeaderButton, never a bare frappe-ui Button — Button.vue only
// applies square icon-button sizing when the slot's vnode type name starts with
// `lucide-`, which a plain `<span class="lucide-save">` does not satisfy.
import { Dialog } from 'frappe-ui'
import type { DialogSize } from 'frappe-ui'
import { nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import { useEventListener, useMediaQuery } from '@vueuse/core'
import { useScreenSize } from '@/utils/composables'
import { useInertBackground } from '@/composables/useInertBackground'
import { focusedElementOwnsLayer, trapTab } from '@/composables/useFocusTrap'

// The transition wraps the teleported node and must never move onto
// <router-view>: a transform on any ancestor would establish a containing block
// for `fixed` (see the Teleport note below).
//
// Enter only. A leave animation needs the page to outlive its own route change,
// and browser-back would hard-cut regardless.
const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)')

withDefaults(defineProps<{ title: string; size?: DialogSize }>(), {
	size: '3xl',
})

const emit = defineEmits<{ close: [] }>()
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

// The desktop Dialog owns its own dismiss affordances (Escape, backdrop, the
// header X); the route is the single source of truth for whether we are open.
const onDialogToggle = (open: boolean): void => {
	if (!open) emit('close')
}

// Teleporting to body is load-bearing, not a11y hygiene: `fixed inset-0` only
// escapes to the viewport because no ancestor establishes a containing block
// for `fixed`, and any layout ancestor gaining a transform/filter/will-change
// would silently reparent this overlay back into main#scrollContainer.
//
// The Escape handler is guarded on isMobile so it never double-fires alongside
// the desktop Dialog's own (frappe-ui-internal) Escape handling.
//
// Tab is trapped because `aria-modal="true"` tells a screen reader the list
// page is not there but does not stop Tab reaching it: this page is last in
// <body>, so Tab off its final stop wraps round into the list. The trap itself
// lives in useFocusTrap, shared with BottomSheet — which makes the same
// aria-modal claim and so owes the same containment.

useEventListener(document, 'keydown', (e: KeyboardEvent) => {
	if (!isMobile.value) return
	if (e.key === 'Escape') {
		// A held Escape would otherwise spend the first press dismissing the
		// popover and close the form on the second, from one key the user
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
// crossing the breakpoint while the form is open swaps the v-if branch and
// destroys whichever node held focus. Reading isMobile at unmount would then
// skip the restore entirely.
let previouslyFocused: HTMLElement | null = null
let tookFocus = false

onMounted(() => {
	if (!isMobile.value) return
	previouslyFocused = document.activeElement as HTMLElement | null
	tookFocus = true
	pageRef.value?.focus()
})

// Re-seat focus across that branch swap; the desktop Dialog seats its own.
watch(isMobile, async (mobile) => {
	if (!tookFocus || !mobile) return
	await nextTick()
	pageRef.value?.focus()
})

// The trigger usually survives — forms are child routes, so the list behind
// stays mounted — but a save reloads the list resource and re-renders its rows,
// so the captured node is replaced. focus() on a detached node is a silent
// no-op that leaves the user on <body>, and so is focusing <body> itself, which
// is what activeElement reads as when nothing had focus. main#scrollContainer
// already carries tabindex="-1" and is already the skip-link target, so it is
// the sanctioned landing spot rather than a new one.
//
// reka's own FocusScope restore runs in a setTimeout(0) after this, but it
// targets a node inside the form being removed, so it lands on nothing.
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
