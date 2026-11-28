import { onBeforeUnmount, watchEffect } from 'vue'
import type { Ref } from 'vue'
import { useElementSize } from '@vueuse/core'

/**
 * Publishes a sticky element's height as a root CSS property, which
 * `--sticky-stack-h` (index.css) sums so everything pinned below the stack and
 * the focus scroll padding clear it. Root-level because the scroll container
 * that needs it is an ancestor.
 */
export function useStickyStackHeight(
	target: Ref<HTMLElement | null>,
	property: `--${string}`
): void {
	const { height } = useElementSize(target, undefined, { box: 'border-box' })
	const style = document.documentElement.style
	watchEffect(() => style.setProperty(property, `${height.value}px`))
	onBeforeUnmount(() => style.removeProperty(property))
}
