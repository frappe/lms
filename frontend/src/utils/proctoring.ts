import type { ViolationEvent } from '@/types'

// Names for the proctoring events, shared by the quiz's own warnings and the
// activity log that lists them.
const VIOLATION_LABELS: Record<string, () => string> = {
	tab_switch: () => __('Tab switch'),
	no_face: () => __('Face not visible'),
	multiple_faces: () => __('Multiple faces'),
	focus_loss: () => __('Window focus lost'),
	camera_disconnect: () => __('Camera disconnected'),
	fullscreen_exit: () => __('Exited full-screen mode'),
	side_panel_detected: () => __('Side panel active'),
}

export function violationLabel(eventType: string): string {
	return VIOLATION_LABELS[eventType]?.() ?? eventType
}

// Every still is a base64 JPEG of up to MAX_VIOLATION_FRAME_CHARS on the server.
// Sending one per event made submission payloads large enough to time out on a
// slow connection (and to invite a retry that recorded a duplicate), so only a
// couple travel. The server enforces its own cap as well.
export const MAX_VIOLATION_FRAMES_SENT = 2

/**
 * Whether proctoring applies to the quiz that is open.
 *
 * Proctoring is for standalone exams and assessments. A quiz embedded in a
 * lesson, an in-video popup, or an author preview must never demand full-screen
 * mode or a camera: the learner is reading a lesson, not sitting an exam.
 */
export interface ProctoringContext {
	enableProctoring: boolean
	preview?: boolean
	inVideo?: boolean
	fromLesson?: boolean
	isEmbeddedInLesson?: boolean
	routeName?: string | null
	routePath?: string | null
}

export function isProctoringAllowed(context: ProctoringContext): boolean {
	if (!context.enableProctoring) return false
	// These are set by the lesson embed, the in-video popup, and the author
	// preview. A query string is not one of them: the learner can add
	// ?fromLesson to the standalone exam URL, and that must not turn proctoring off.
	if (
		context.preview ||
		context.inVideo ||
		context.fromLesson ||
		context.isEmbeddedInLesson
	) {
		return false
	}
	if (context.routeName === 'Lesson') return false

	// Any course learning route: /courses/:courseName/learn/...
	const path = context.routePath
	return !(path && path.includes('/courses/') && path.includes('/learn/'))
}

type FullscreenDocument = Document & {
	webkitFullscreenElement?: Element | null
	msFullscreenElement?: Element | null
	webkitFullscreenEnabled?: boolean
	mozFullScreenEnabled?: boolean
	msFullscreenEnabled?: boolean
}

// The standard Fullscreen API and the prefixed one report different properties.
// Checking only document.fullscreenElement leaves a prefixed session looking
// like it never entered, so the exam modal never clears.
export function currentFullscreenElement(): Element | null {
	if (typeof document === 'undefined') return null
	const doc = document as FullscreenDocument
	return (
		document.fullscreenElement ||
		doc.webkitFullscreenElement ||
		doc.msFullscreenElement ||
		null
	)
}

export function isFullscreenSupported(): boolean {
	if (typeof document === 'undefined') return false
	const doc = document as FullscreenDocument
	return !!(
		doc.fullscreenEnabled ||
		doc.webkitFullscreenEnabled ||
		doc.mozFullScreenEnabled ||
		doc.msFullscreenEnabled
	)
}

export const FULLSCREEN_CHANGE_EVENTS = [
	'fullscreenchange',
	'webkitfullscreenchange',
	'msfullscreenchange',
] as const

// Browsers drop fullscreen as part of hiding the tab, and the events can arrive
// a moment apart. Wait long enough for that pair to land together, and not so
// long that pressing Escape and coming straight back goes unrecorded.
export const FULLSCREEN_EXIT_GRACE_MS = 100
export const TAB_SWITCH_SUPPRESSES_FULLSCREEN_MS = 2000

export interface SidePanelViewport {
	fullscreen: boolean
	screenWidth: number
	screenHeight: number
	innerWidth: number
	innerHeight: number
	userAgent?: string
}

/**
 * A docked side panel (Gemini, Copilot) or a bottom dock (devtools) changes one
 * axis of the fullscreen viewport and leaves the other essentially full.
 *
 * Page zoom shrinks both axes together, so a gap on only one axis is what
 * separates a dock from a zoomed page. Mobile browsers draw their own chrome
 * and are excluded.
 */
export function isSidePanelViewport({
	fullscreen,
	screenWidth,
	screenHeight,
	innerWidth,
	innerHeight,
	userAgent = '',
}: SidePanelViewport): boolean {
	if (!fullscreen) return false
	if (/Android|iPhone|iPad|iPod|Mobile/i.test(userAgent)) return false

	const widthTaken = screenWidth - innerWidth
	const heightTaken = screenHeight - innerHeight
	const sideDock = widthTaken >= 200 && heightTaken < 100
	const bottomDock = heightTaken >= 200 && widthTaken < 100
	return sideDock || bottomDock
}

/**
 * Serialise the attempt's event log for submit_quiz, keeping only the most
 * recent `maxFrames` stills. Events stay in chronological order; earlier ones
 * are sent without a frame so the instructor still sees that they happened.
 *
 * The newest stills are the ones that show the incident. Keeping the oldest
 * two usually stored the "look at the camera" warnings from the start and
 * dropped the picture of a later tab switch.
 */
export function serialiseViolationLog(
	log: ViolationEvent[],
	{
		withFrames = true,
		maxFrames = MAX_VIOLATION_FRAMES_SENT,
	}: { withFrames?: boolean; maxFrames?: number } = {}
): string {
	const chronological = [...log].reverse()
	const keepFrame = new Set<number>()
	if (withFrames) {
		for (
			let index = chronological.length - 1;
			index >= 0 && keepFrame.size < maxFrames;
			index--
		) {
			if (chronological[index].frame) keepFrame.add(index)
		}
	}
	return JSON.stringify(
		chronological.map(({ frame, ...event }, index) =>
			keepFrame.has(index) ? { ...event, frame } : { ...event, frame: null }
		)
	)
}
