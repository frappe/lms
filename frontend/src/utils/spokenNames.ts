/**
 * The browser's speech engine does not know the names a lesson uses, so it writes the nearest
 * word it knows: "Frappe" comes out as "Flappy". A capitalised word that is one or two letters
 * from one of the conversation's names, and starts with the same letter, is that name.
 */
export function withNames(text: string, names: string[]): string {
	const known = names.filter((name) => /^[A-Za-z][A-Za-z-]{4,}$/.test(name))
	if (!text || !known.length) return text
	return text.replace(/\b([A-Z][a-z]+)\b/g, (word) => nearestName(word, known) || word)
}

function nearestName(word: string, names: string[]): string | null {
	const heard = word.toLowerCase()
	for (const name of names) {
		const target = name.toLowerCase()
		if (heard[0] !== target[0]) continue
		// The same word, or a form of it ("Teams" for "Team"), is not a mishearing.
		if (heard.startsWith(target) || target.startsWith(heard)) continue
		const allowed = target.length >= 6 ? 2 : 1
		if (Math.abs(heard.length - target.length) > allowed) continue
		if (distance(heard, target) <= allowed) return name
	}
	return null
}

/** Letters to add, drop or change to turn one word into the other. */
function distance(a: string, b: string): number {
	let previous = Array.from({ length: b.length + 1 }, (_, i) => i)
	for (let i = 1; i <= a.length; i++) {
		const row = [i]
		for (let j = 1; j <= b.length; j++)
			row[j] = Math.min(
				previous[j] + 1,
				row[j - 1] + 1,
				previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
			)
		previous = row
	}
	return previous[b.length]
}
