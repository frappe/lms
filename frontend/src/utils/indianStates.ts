/** Indian states and union territories, spelled as GST registrations expect them. */
// Invoices key place-of-supply off this exact spelling, so checkout stores the
// canonical form rather than whatever casing the learner typed.
export const INDIAN_STATES = [
	'Andaman and Nicobar Islands',
	'Andhra Pradesh',
	'Arunachal Pradesh',
	'Assam',
	'Bihar',
	'Chandigarh',
	'Chhattisgarh',
	'Dadra and Nagar Haveli and Daman and Diu',
	'Delhi',
	'Goa',
	'Gujarat',
	'Haryana',
	'Himachal Pradesh',
	'Jammu and Kashmir',
	'Jharkhand',
	'Karnataka',
	'Kerala',
	'Ladakh',
	'Lakshadweep',
	'Madhya Pradesh',
	'Maharashtra',
	'Manipur',
	'Meghalaya',
	'Mizoram',
	'Nagaland',
	'Odisha',
	'Puducherry',
	'Punjab',
	'Rajasthan',
	'Sikkim',
	'Tamil Nadu',
	'Telangana',
	'Tripura',
	'Uttar Pradesh',
	'Uttarakhand',
	'West Bengal',
] as const

export const INDIAN_STATE_OPTIONS = INDIAN_STATES.map((state) => ({
	label: state,
	value: state,
}))

const BY_COMPARABLE = new Map(
	INDIAN_STATES.map((state) => [comparable(state), state])
)

function comparable(value: string): string {
	return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** The canonical spelling of an Indian state, or null when the value is not one. */
// Case and stray whitespace are ignored: "GUJARAT" and " tamil nadu " resolve.
export function canonicalIndianState(value: unknown): string | null {
	if (typeof value !== 'string') return null
	return BY_COMPARABLE.get(comparable(value)) ?? null
}
