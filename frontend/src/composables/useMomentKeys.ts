import { onBeforeUnmount, onMounted, type Ref } from 'vue'

/**
 * Number keys pick an option and Enter checks, for the newest unanswered exercise.
 * Keys typed into a text field stay with the field.
 */
export function useMomentKeys(
	active: Ref<boolean | undefined>,
	count: () => number,
	onPick: (index: number) => void,
	onCheck: () => void,
) {
	const onKey = (event: KeyboardEvent) => {
		if (!active.value || event.metaKey || event.ctrlKey || event.altKey) return
		const target = event.target as HTMLElement | null
		if (target?.closest('input, textarea, select, [contenteditable="true"]'))
			return
		const index = Number(event.key) - 1
		if (Number.isInteger(index) && index >= 0 && index < Math.min(count(), 9)) {
			event.preventDefault()
			onPick(index)
		} else if (event.key === 'Enter' && target?.tagName !== 'BUTTON') {
			event.preventDefault()
			onCheck()
		}
	}
	onMounted(() => window.addEventListener('keydown', onKey))
	onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
}
