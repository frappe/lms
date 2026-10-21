import { describe, expect, it, vi } from 'vitest'

vi.stubGlobal('__', (text: string) => text)
String.prototype.format = function (...args: unknown[]) {
	return this.replace(/\{(\d+)\}/g, (_: string, i: number) => String(args[i]))
}

import {
	newRange,
	nextRange,
	rangeErrors,
	standardWeek,
	timeOffError,
	toHHMM,
	toRows,
	toWeek,
} from '@/utils/evaluatorAvailability'

describe('toWeek / toRows', () => {
	it('groups rows by weekday, sorted, and flattens back in week order', () => {
		const week = toWeek([
			{ day: 'Wednesday', start_time: '10:00:00', end_time: '11:00:00' },
			{ day: 'Monday', start_time: '14:00:00', end_time: '15:00:00' },
			{ day: 'Monday', start_time: '9:00:00', end_time: '10:00:00' },
		])

		expect(week.Monday.map((r) => r.start)).toEqual(['09:00', '14:00'])
		expect(week.Tuesday).toEqual([])
		expect(toRows(week)).toEqual([
			{ day: 'Monday', start_time: '09:00', end_time: '10:00' },
			{ day: 'Monday', start_time: '14:00', end_time: '15:00' },
			{ day: 'Wednesday', start_time: '10:00', end_time: '11:00' },
		])
	})

	it.each([
		['9:00:00', '09:00'],
		['17:30:00', '17:30'],
		['', ''],
		[null, ''],
	])('toHHMM(%s) is %s', (input, expected) => {
		expect(toHHMM(input)).toBe(expected)
	})
})

describe('nextRange', () => {
	it('starts a day at 09:00 to 17:00', () => {
		expect(nextRange([])).toMatchObject({ start: '09:00', end: '17:00' })
	})

	it('starts where the last range ends, so it never overlaps', () => {
		const ranges = [newRange('09:00', '12:00')]
		expect(nextRange(ranges)).toMatchObject({ start: '12:00', end: '13:00' })
	})

	it('stops at the end of the day', () => {
		const ranges = [newRange('20:00', '23:30')]
		expect(nextRange(ranges)).toMatchObject({ start: '23:30', end: '23:59' })
	})
})

describe('rangeErrors', () => {
	const cases: Array<{
		name: string
		ranges: [string, string][]
		errors: (string | undefined)[]
	}> = [
		{
			name: 'one valid range',
			ranges: [['09:00', '10:00']],
			errors: [undefined],
		},
		{
			name: 'end before start',
			ranges: [['11:00', '10:00']],
			errors: ['End time must be after the start time.'],
		},
		{
			name: 'end equal to start',
			ranges: [['10:00', '10:00']],
			errors: ['End time must be after the start time.'],
		},
		{
			name: 'a missing time',
			ranges: [['09:00', '']],
			errors: ['Set both a start and an end time.'],
		},
		{
			name: 'two overlapping ranges',
			ranges: [
				['09:00', '12:00'],
				['11:00', '13:00'],
			],
			errors: ['Overlaps with 11:00 – 13:00.', 'Overlaps with 09:00 – 12:00.'],
		},
		{
			name: 'back-to-back ranges',
			ranges: [
				['09:00', '12:00'],
				['12:00', '13:00'],
			],
			errors: [undefined, undefined],
		},
	]

	it.each(cases)('$name', ({ ranges, errors }) => {
		const built = ranges.map(([start, end]) => newRange(start, end))
		const found = rangeErrors(built)
		expect(built.map((range) => found[range.key])).toEqual(errors)
	})
})

describe('timeOffError', () => {
	it.each([
		{ from: null, to: null, error: '' },
		{ from: '2030-01-01', to: '2030-01-05', error: '' },
		{ from: '2030-01-01', to: null, error: 'Set both dates, or clear them.' },
		{ from: null, to: '2030-01-05', error: 'Set both dates, or clear them.' },
		{
			from: '2030-01-05',
			to: '2030-01-01',
			error: 'The end date must be after the start date.',
		},
		{
			from: '2030-01-05',
			to: '2030-01-05',
			error: 'The end date must be after the start date.',
		},
	])('from $from to $to', ({ from, to, error }) => {
		expect(timeOffError({ from, to })).toBe(error)
	})
})

describe('standardWeek', () => {
	it('is 09:00 to 17:00 on weekdays, with the weekend off', () => {
		const week = standardWeek()
		expect(
			Object.entries(week).map(([day, ranges]) => [
				day,
				ranges.map((r) => `${r.start}-${r.end}`),
			])
		).toEqual([
			['Monday', ['09:00-17:00']],
			['Tuesday', ['09:00-17:00']],
			['Wednesday', ['09:00-17:00']],
			['Thursday', ['09:00-17:00']],
			['Friday', ['09:00-17:00']],
			['Saturday', []],
			['Sunday', []],
		])
	})
})
