// The home pages open with the same line for learners and instructors.

export const firstName = (fullName?: string) =>
	(fullName || '').trim().split(/\s+/)[0] || ''

export const greeting = (fullName?: string) => {
	const hour = new Date().getHours()
	const hello =
		hour < 12
			? __('Good morning')
			: hour < 17
				? __('Good afternoon')
				: __('Good evening')
	const first = firstName(fullName)
	return first ? __('{0}, {1}').format(hello, first) : hello
}

export const welcome = (fullName?: string) => {
	const first = firstName(fullName)
	return first ? __('Welcome, {0}').format(first) : __('Welcome')
}
