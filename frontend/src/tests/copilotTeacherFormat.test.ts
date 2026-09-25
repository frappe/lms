import { describe, expect, it, vi } from 'vitest'

const translate = (text: string) =>
	/{\d+}/.test(text)
		? {
				format: (...args: unknown[]) =>
					text.replace(/{(\d+)}/g, (match, index) =>
						args[index] !== undefined ? String(args[index]) : match
					),
			}
		: text
vi.stubGlobal('__', translate)

const format = await import('@/components/Copilot/teacher/format')

describe('copilot teacher formatters', () => {
	it('labels every queue kind and falls back to the raw kind', () => {
		expect(format.kindLabel('feedback')).toBe('Project feedback')
		expect(format.kindLabel('Escalation')).toBe('Question for you')
		expect(format.kindLabel('Something New')).toBe('Something New')
		expect(format.KIND_KEYS).toContain('Course Draft')
	})

	it('maps confidence and status to badge themes', () => {
		expect(format.confidenceTheme('High')).toBe('green')
		expect(format.confidenceTheme('Low')).toBe('red')
		expect(format.confidenceLabel(null)).toBe('—')
		expect(format.statusTheme('Queued')).toBe('amber')
		expect(format.statusTheme('Failed')).toBe('red')
		expect(format.statusTheme('Unknown')).toBe('gray')
	})

	it('measures age against the server clock', () => {
		const now = new Date('2026-09-25T12:00:00').getTime()
		expect(format.ago('2026-09-25 11:50:00', 0, now)).toBe('10 min')
		expect(format.ago('2026-09-25 09:00:00', 0, now)).toBe('3 h')
		expect(format.ago('2026-09-22 12:00:00', 0, now)).toBe('3 d')
		// Server is one hour ahead of the browser.
		expect(format.ago('2026-09-25 12:30:00', 3600_000, now)).toBe('30 min')
		expect(format.ago(null)).toBe('')
	})

	it('builds GitHub links and raw file URLs for a citation', () => {
		const submission = {
			repo_url: 'https://github.com/alice/project',
			commit: 'abc1234',
		}
		expect(
			format.githubLine(submission, {
				file: 'src/app.py',
				line_start: 3,
				line_end: 7,
			})
		).toBe('https://github.com/alice/project/blob/abc1234/src/app.py#L3-L7')
		expect(format.rawFileUrl(submission, 'src/my file.py')).toBe(
			'https://raw.githubusercontent.com/alice/project/abc1234/src/my%20file.py'
		)
		expect(
			format.rawFileUrl({ repo_url: 'https://gitlab.com/a/b' }, 'x.py')
		).toBeNull()
	})

	it('labels citations by label, file range or lesson', () => {
		expect(format.citationLabel({ label: 'Intro' })).toBe('Intro')
		expect(
			format.citationLabel({ file: 'src/app.py', line_start: 4, line_end: 9 })
		).toBe('app.py:4–9')
		expect(
			format.citationLabel({ file: 'app.py', line_start: 4, line_end: 4 })
		).toBe('app.py:4')
		expect(format.citationLabel({ lesson: 'LESSON-1' })).toBe('LESSON-1')
	})

	it('collects cited files and highlighted ranges', () => {
		const scores = [
			{ citations: [{ file: 'a.py', line_start: 1, line_end: 3 }] },
			{
				citations: [
					{ file: 'b.py', line_start: 5 },
					{ file: 'a.py', line_start: 10, line_end: 12 },
					{ lesson: 'L1' },
				],
			},
		]
		expect(format.citedFiles(scores)).toEqual(['a.py', 'b.py'])
		expect(format.citedRanges(scores, 'a.py')).toEqual([
			[1, 3],
			[10, 12],
		])
		expect(format.citedRanges(scores, 'b.py')).toEqual([[5, 5]])
	})

	it('suggests Fail when any criterion sits at the lowest level', () => {
		expect(format.suggestedResult({ A: 2, B: 3 })).toBe('Pass')
		expect(format.suggestedResult({ A: 1, B: 3 })).toBe('Fail')
	})

	it('renders diff lines with a sign and strips the one in the text', () => {
		expect(format.diffLine({ op: 'add', text: '+ new' })).toBe('+ new')
		expect(format.diffLine({ op: 'del', text: 'old' })).toBe('- old')
		expect(format.diffLine({ op: 'skip', text: '… 4 unchanged lines' })).toBe(
			'  … 4 unchanged lines'
		)
	})

	it('reads server errors as plain text', () => {
		expect(
			format.errorText({ messages: ['<b>Not</b> allowed'], message: 'x' })
		).toBe('Not allowed')
		expect(format.errorText(new Error('Boom'))).toBe('Boom')
		expect(format.errorText(null)).toBe(
			'Something went wrong. Please try again.'
		)
	})

	it('labels insight evidence of any shape', () => {
		expect(format.evidenceLabel('plain')).toBe('plain')
		expect(format.evidenceLabel({ label: 'Labelled' })).toBe('Labelled')
		expect(format.evidenceLabel({ draft: 'D1' })).toBe('{"draft":"D1"}')
	})
})
