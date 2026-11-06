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
	fromLessonQuery?: boolean
	routeName?: string | null
	routePath?: string | null
}

export function isProctoringAllowed(context: ProctoringContext): boolean {
	if (!context.enableProctoring) return false
	if (
		context.preview ||
		context.inVideo ||
		context.fromLesson ||
		context.isEmbeddedInLesson
	) {
		return false
	}
	if (context.fromLessonQuery) return false
	if (context.routeName === 'Lesson') return false

	// Any course learning route: /courses/:courseName/learn/...
	const path = context.routePath
	return !(path && path.includes('/courses/') && path.includes('/learn/'))
}

export interface SidePanelViewport {
	fullscreen: boolean
	screenWidth: number
	screenHeight: number
	innerWidth: number
	innerHeight: number
	userAgent?: string
}

/**
 * A browser side panel (Gemini, Copilot, a docked devtools) narrows the
 * viewport while full-screen, without taking any height.
 *
 * Page zoom also narrows the viewport but takes height in the same step, so
 * requiring the height to stay full keeps a zoomed page from being mistaken for
 * a side panel. Mobile browsers draw their own chrome, so they are excluded.
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
	return widthTaken >= 200 && heightTaken < 100
}

/**
 * Serialise the attempt's event log for submit_quiz, keeping only the first
 * `maxFrames` stills. Events stay in chronological order; the rest are sent
 * without a frame so the instructor still sees that they happened.
 */
export function serialiseViolationLog(
	log: ViolationEvent[],
	{
		withFrames = true,
		maxFrames = MAX_VIOLATION_FRAMES_SENT,
	}: { withFrames?: boolean; maxFrames?: number } = {}
): string {
	let framesKept = 0
	return JSON.stringify(
		[...log].reverse().map(({ frame, ...event }) => {
			if (withFrames && frame && framesKept < maxFrames) {
				framesKept++
				return { ...event, frame }
			}
			return { ...event, frame: null }
		})
	)
}
