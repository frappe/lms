<template>
	<Teleport to="body">
		<Transition name="sheet-backdrop">
			<div
				v-if="modelValue"
				class="fixed inset-0 z-40 bg-black/40"
				@click="close"
			/>
		</Transition>
		<Transition name="sheet-panel">
			<div
				v-if="modelValue"
				ref="panel"
				class="pb-safe-4 fixed inset-x-0 bottom-0 z-40 flex max-h-[85vh] flex-col rounded-t-2xl bg-surface-base shadow-2xl"
				:style="panelStyle"
				role="dialog"
				aria-modal="true"
				tabindex="-1"
				:aria-labelledby="title ? titleId : undefined"
				:aria-label="!title && ariaLabel ? ariaLabel : undefined"
			>
				<div
					ref="handle"
					class="flex shrink-0 cursor-grab justify-center pb-1 pt-3 active:cursor-grabbing"
				>
					<div class="h-1 w-9 rounded-full bg-surface-gray-4" />
				</div>

				<div
					v-if="title || $slots.header"
					class="flex shrink-0 items-start justify-between gap-3 px-5 pb-3 pt-1"
				>
					<slot name="header">
						<div :id="titleId" class="text-p-lg-semibold text-ink-gray-9">
							{{ title }}
						</div>
					</slot>
				</div>

				<div class="flex-1 overflow-y-auto overscroll-contain px-2 pb-4">
					<slot />
				</div>
			</div>
		</Transition>
	</Teleport>
</template>

<script setup>
import { ref, computed, watch, nextTick, useId } from 'vue'
import { useScrollLock, useSwipe, useEventListener } from '@vueuse/core'
import { focusStops, trapTab } from '@/composables/useFocusTrap'
import { useInertBackground } from '@/composables/useInertBackground'

const props = defineProps({
	modelValue: {
		type: Boolean,
		default: false,
	},
	title: {
		type: String,
		default: '',
	},
	// A sheet whose sections name themselves shows no title, but the dialog
	// still needs a name or it announces as nothing at all.
	ariaLabel: {
		type: String,
		default: '',
	},
})

const titleId = useId()

const emit = defineEmits(['update:modelValue'])

const panel = ref(null)
const handle = ref(null)

function close() {
	emit('update:modelValue', false)
}

// Lock the page behind the sheet so scrolling the list doesn't scroll the
// lesson underneath it.
const bodyLock = useScrollLock(
	typeof document !== 'undefined' ? document.body : null
)
// Without this the sheet opens and focus stays wherever it was, behind the
// backdrop: a keyboard or screen-reader user gets no signal it appeared, and
// on close no way back to where they were. Restoring focus to the trigger is
// also what makes the sheet read as belonging to the button that opened it.
//
// Inerting the app behind it is the other half of the `aria-modal="true"` the
// panel claims, and is what the ref-counting in useInertBackground was written
// for — this sheet can open from inside a FormShell that is already holding it.
useInertBackground(computed(() => props.modelValue))

let previouslyFocused = null

watch(
	() => props.modelValue,
	async (open) => {
		bodyLock.value = open

		if (open) {
			previouslyFocused = document.activeElement
			await nextTick()
			// The panel itself is the fallback, hence its tabindex="-1": a sheet
			// holding nothing focusable still has to take focus off the page behind.
			// focusStops, not a bare querySelector: frappe-ui renders hidden inputs
			// that match the selector but cannot hold focus.
			const [first] = panel.value ? focusStops(panel.value) : []
			if (first) first.focus()
			else panel.value?.focus()
			return
		}

		previouslyFocused?.focus?.()
		previouslyFocused = null
	}
)

// Esc closes, matching the backdrop tap. Tab stays inside: the panel is last in
// <body> and claims aria-modal, so without this Tab off its final option lands
// on the page behind the backdrop — invisible to the user moving through it,
// and already announced as not being there.
useEventListener(document, 'keydown', (e) => {
	if (!props.modelValue) return
	if (e.key === 'Escape') {
		close()
		return
	}
	if (e.key !== 'Tab') return
	trapTab(e, panel.value)
})

// Swipe-down on the handle drags the panel and closes it past a threshold.
const dragOffset = ref(0)
const { lengthY, isSwiping } = useSwipe(handle, {
	onSwipe() {
		// lengthY = startY - currentY, so a downward drag is negative; only
		// follow downward motion and never let the sheet drift upward.
		const down = -lengthY.value
		dragOffset.value = down > 0 ? down : 0
	},
	onSwipeEnd() {
		if (dragOffset.value > 80) close()
		dragOffset.value = 0
	},
})

const panelStyle = computed(() => ({
	transform: dragOffset.value ? `translateY(${dragOffset.value}px)` : '',
	transition: isSwiping.value ? 'none' : '',
}))
</script>

<style scoped>
.sheet-backdrop-enter-active,
.sheet-backdrop-leave-active {
	transition: opacity 200ms ease;
}
.sheet-backdrop-enter-from,
.sheet-backdrop-leave-to {
	opacity: 0;
}

.sheet-panel-enter-active,
.sheet-panel-leave-active {
	transition: transform 250ms cubic-bezier(0.32, 0.72, 0, 1);
}
.sheet-panel-enter-from,
.sheet-panel-leave-to {
	transform: translateY(100%);
}
</style>
