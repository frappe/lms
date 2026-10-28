// Names for the proctoring events, shared by the quiz's own warnings and the
// activity log that lists them.
const VIOLATION_LABELS: Record<string, () => string> = {
	tab_switch: () => __('Tab switch'),
	no_face: () => __('Face not visible'),
	multiple_faces: () => __('Multiple faces'),
	focus_loss: () => __('Window focus lost'),
	camera_disconnect: () => __('Camera disconnected'),
}

export function violationLabel(eventType: string): string {
	return VIOLATION_LABELS[eventType]?.() ?? eventType
}
