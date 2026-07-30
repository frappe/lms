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
				class="standalone:pb-4 fixed inset-x-0 bottom-0 z-40 flex max-h-[85vh] flex-col rounded-t-2xl bg-surface-base shadow-2xl"
				:style="panelStyle"
				role="dialog"
				aria-modal="true"
			>
				<!-- Drag handle -->
				<div
					ref="handle"
					class="flex shrink-0 cursor-grab justify-center pb-1 pt-3 active:cursor-grabbing"
				>
					<div class="h-1 w-9 rounded-full bg-surface-gray-4" />
				</div>

				<!-- Header -->
				<div
					v-if="title || $slots.header"
					class="flex shrink-0 items-start justify-between gap-3 px-5 pb-3 pt-1"
				>
					<slot name="header">
						<div class="text-p-lg-semibold text-ink-gray-9">{{ title }}</div>
					</slot>
				</div>

				<!-- Body -->
				<div class="flex-1 overflow-y-auto overscroll-contain px-2 pb-4">
					<slot />
				</div>
			</div>
		</Transition>
	</Teleport>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useScrollLock, useSwipe, useEventListener } from '@vueuse/core'

const props = defineProps({
	modelValue: {
		type: Boolean,
		default: false,
	},
	title: {
		type: String,
		default: '',
	},
})

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
watch(
	() => props.modelValue,
	(open) => {
		bodyLock.value = open
	}
)

// Esc closes, matching the backdrop tap.
useEventListener(document, 'keydown', (e) => {
	if (props.modelValue && e.key === 'Escape') close()
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
