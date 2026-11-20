import { describe, expect, it } from 'vitest'
import { withNames } from '@/utils/spokenNames'

const names = ['Frappe', 'QMS', 'Quality', 'Manual', 'Fenwick', 'Lumi', 'Team']

describe('names the browser misheard', () => {
	it('puts a misheard name right', () => {
		expect(withNames('I work in the Flappy team', names)).toBe('I work in the Frappe team')
		expect(withNames('Frappy policy says so', names)).toBe('Frappe policy says so')
		expect(withNames('Thanks Fenwik', names)).toBe('Thanks Fenwick')
	})

	it('leaves ordinary words and other names alone', () => {
		const said = 'I am happy, the manual is mutual and Frank agreed'
		expect(withNames(said, names)).toBe(said)
		expect(withNames('Quality comes first', names)).toBe('Quality comes first')
		expect(withNames('Flappy', [])).toBe('Flappy')
		expect(withNames('Teams and Manuals', names)).toBe('Teams and Manuals')
	})
})
