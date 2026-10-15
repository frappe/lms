// A picker's closed label for a list of people, by first name: "Dharmesh",
// "Dharmesh and Ashley", "Dharmesh, Ashley and Sayali", then "Dharmesh, Ashley
// and others". Reads better than "2 selected", and stays short past three.

// A user's label is their full name, or their email when they have none.
const firstName = (label: string): string =>
	label.trim().split(/[\s@]/)[0] || label

export function summarisePeople(labels: string[]): string {
	const names = labels.filter(Boolean).map(firstName)
	if (names.length <= 1) return names[0] ?? ''
	if (names.length === 2) return __('{0} and {1}').format(names[0], names[1])
	if (names.length === 3)
		return __('{0}, {1} and {2}').format(names[0], names[1], names[2])
	return __('{0}, {1} and others').format(names[0], names[1])
}
