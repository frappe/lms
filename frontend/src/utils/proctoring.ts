// Names for the proctoring events, shared by the quiz's own warnings and the
// activity log that lists them.
const VIOLATION_LABELS: Record<string, () => string> = {
	tab_switch: () => __('Tab switch'),
	no_face: () => __('Face not visible'),
	multiple_faces: () => __('Multiple faces'),
	focus_loss: () => __('Window focus lost'),
	camera_disconnect: () => __('Camera disconnected'),
	fullscreen_exit: () => __('Exited full-screen mode'),
}

export function violationLabel(eventType: string): string {
	return VIOLATION_LABELS[eventType]?.() ?? eventType
}

// How long the learner has to re-enter full-screen before a violation is logged
export const FULLSCREEN_EXIT_GRACE_MS = 2500

// Fullscreen API vendor-prefixed cross-browser change events
export const FULLSCREEN_CHANGE_EVENTS = [
	'fullscreenchange',
	'webkitfullscreenchange',
	'mozfullscreenchange',
	'MSFullscreenChange',
] as const

/**
 * Returns true if full-screen mode is supported by the user agent / browser.
 */
export function isFullscreenSupported(): boolean {
	if (typeof document === 'undefined') return false
	return Boolean(
		document.fullscreenEnabled ||
			(document as any).webkitFullscreenEnabled ||
			(document as any).mozFullScreenEnabled ||
			(document as any).msFullscreenEnabled
	)
}

/**
 * Returns the element currently displayed in full-screen mode, or null.
 */
export function currentFullscreenElement(): Element | null {
	if (typeof document === 'undefined') return null
	return (
		document.fullscreenElement ||
		(document as any).webkitFullscreenElement ||
		(document as any).mozFullScreenElement ||
		(document as any).msFullscreenElement ||
		null
	)
}
