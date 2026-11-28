// Labels the `icon` the server derives from lesson content (get_lesson_icon).
const KIND_LABELS: Record<string, () => string> = {
	'icon-youtube': () => __('Video'),
	'icon-quiz': () => __('Quiz'),
	'icon-assignment': () => __('Assignment'),
	'icon-code': () => __('Programming exercise'),
	'icon-list': () => __('Reading'),
}

export const lessonKindLabel = (icon?: string | null): string =>
	icon && KIND_LABELS[icon] ? KIND_LABELS[icon]() : ''
