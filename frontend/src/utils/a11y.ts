import { onScopeDispose, readonly, ref, watch } from 'vue'

/* Moves focus to the skip-link target without a native fragment navigation,
   which would overwrite the hash that pages like CourseDetail use for tab
   state. The target carries tabindex="-1" so it can take focus. */
export function skipToContent(id: string) {
	document.getElementById(id)?.focus()
}

const ANNOUNCE_DELAY = 500

/* Text for one role="status" region per page, for the reader who cannot see the
   aria-hidden skeleton. The caller owns the markup and the wording.

   A timer, not nextTick: a microtask lands the insert and the text in one frame
   and the region is read as if it arrived already full. Clearing before each
   write buys the same beat, and makes a repeat of the same string mutate
   something — two filters both returning 24 rows must both be heard. The delay
   doubles as a trailing debounce for search boxes that refetch per keystroke;
   both getters are read when it fires, so the count quoted is the one on screen.

   Either getter may return '' to say nothing. `settled` only speaks once
   `pending` has been seen, so a page rendered from cache stays silent. */
export function useLoadingAnnouncement(
	pending: () => boolean,
	settled: () => string,
	started: () => string = () => __('Loading…')
) {
	const message = ref('')
	let sawPending = false
	let timer: ReturnType<typeof setTimeout> | undefined

	function say(text: () => string) {
		clearTimeout(timer)
		message.value = ''
		timer = setTimeout(() => {
			message.value = text()
		}, ANNOUNCE_DELAY)
	}

	watch(
		pending,
		(isPending) => {
			if (!isPending && !sawPending) return
			sawPending = isPending
			say(isPending ? started : settled)
		},
		{ immediate: true }
	)

	onScopeDispose(() => clearTimeout(timer))

	return readonly(message)
}
