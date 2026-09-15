// Compare two route.query objects ignoring key order: a snapshot and a query
// re-parsed from the URL differ in key order but not meaning.
export const queryEqual = (a: object, b: object) =>
	JSON.stringify(Object.entries(a).sort()) ===
	JSON.stringify(Object.entries(b).sort())
