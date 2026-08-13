import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import safeHtml from '../directives/safeHtml'

const mountAt = (level: string | null, html: string) =>
	mount(
		{
			template: level
				? `<div v-safe-html:${level}="html" />`
				: '<div v-safe-html="html" />',
			props: { html: String },
		},
		{ props: { html }, global: { directives: { 'safe-html': safeHtml } } }
	)

describe('v-safe-html', () => {
	it('strips script tags and inline handlers at every level', () => {
		for (const level of ['rich', 'basic', 'bio']) {
			const html = mountAt(
				level,
				'<img src=x onerror=alert(1)><script>alert(1)</script>'
			).html()
			expect(html, level).not.toContain('onerror')
			expect(html, level).not.toContain('<script')
		}
	})

	it('rich keeps presentational markup but drops form elements', () => {
		const html = mountAt(
			'rich',
			'<div class="a"><p>hi</p><input name="x"></div>'
		).html()
		expect(html).toContain('<p>hi</p>')
		expect(html).toContain('class="a"')
		expect(html).not.toContain('<input')
	})

	it('basic keeps tables, bio does not', () => {
		expect(
			mountAt('basic', '<table><tr><td>c</td></tr></table>').html()
		).toContain('<td>')
		expect(
			mountAt('bio', '<table><tr><td>c</td></tr></table>').html()
		).not.toContain('<td>')
	})

	it('bio drops headings that basic keeps', () => {
		expect(mountAt('basic', '<h2>t</h2>').html()).toContain('<h2>')
		expect(mountAt('bio', '<h2>t</h2>').html()).not.toContain('<h2>')
	})

	it('an absent level falls back to the strictest profile, not the loosest', () => {
		const html = mountAt(
			null,
			'<table><tr><td>c</td></tr></table><h2>t</h2>'
		).html()
		expect(html).not.toContain('<td>')
		expect(html).not.toContain('<h2>')
	})

	it('an unknown level falls back to the strictest profile', () => {
		expect(mountAt('nonsense', '<h2>t</h2>').html()).not.toContain('<h2>')
	})

	it('forces safe anchor rel/target at every level', () => {
		for (const level of ['rich', 'basic', 'bio']) {
			const html = mountAt(level, '<a href="https://e.com">x</a>').html()
			expect(html, level).toContain('rel="noopener noreferrer"')
			expect(html, level).toContain('target="_blank"')
		}
	})

	it('re-sanitizes on update, not only on mount', async () => {
		const wrapper = mountAt('rich', '<p>safe</p>')
		await wrapper.setProps({ html: '<img src=x onerror=alert(1)>' })
		expect(wrapper.html()).not.toContain('onerror')
	})
})

const sources = import.meta.glob('../**/*.vue', {
	query: '?raw',
	import: 'default',
	eager: true,
}) as Record<string, string>

const HTML_COMMENT = /<!--[\s\S]*?-->/g
const live = (src: string) => src.replace(HTML_COMMENT, '')

describe('no raw v-html remains', () => {
	it('finds components to scan', () => {
		expect(Object.keys(sources).length).toBeGreaterThan(50)
	})

	it('finds no v-html outside the directive itself', () => {
		const offenders = Object.entries(sources)
			.filter(([, src]) => /\sv-html=/.test(live(src)))
			.map(([path]) => path)
		expect(offenders, offenders.join('\n')).toEqual([])
	})

	// The same ban as .github/semgrep/vue-directives.yml's no-bound-innerhtml-prop,
	// mirrored here because semgrep runs in CI only: without this a contributor
	// sees a green local suite and learns about the rule from a failed job. Vue
	// assigns el.innerHTML for every spelling below, so v-html is only the most
	// obvious one.
	const INNER_HTML_PROP = [
		/(?:^|[\s"'`([{])(?:\.|:|v-bind:)inner-?html(?:\.[a-zA-Z]+)?\s*=/i,
		/v-bind\s*=\s*"[^"]*\binner-?html\s*[:}]/i,
	]

	it('matches every innerHTML spelling it bans', () => {
		const sinks = [
			'<div :innerHTML="a" />',
			'<div v-bind:innerHTML="a" />',
			'<div .innerHTML="a" />',
			'<div :innerHTML.prop="a" />',
			'<div v-bind="{ innerHTML: a }" />',
		]
		for (const sink of sinks)
			expect(
				INNER_HTML_PROP.some((re) => re.test(sink)),
				sink
			).toBe(true)
		expect(INNER_HTML_PROP.some((re) => re.test('<div :title="a" />'))).toBe(
			false
		)
	})

	it('finds no bound innerHTML prop', () => {
		const offenders = Object.entries(sources)
			.filter(([, src]) => INNER_HTML_PROP.some((re) => re.test(live(src))))
			.map(([path]) => path)
		expect(offenders, offenders.join('\n')).toEqual([])
	})

	it('finds no v-safe-html without an explicit known level', () => {
		const KNOWN = ['rich', 'basic', 'bio']
		const offenders: string[] = []
		for (const [path, src] of Object.entries(sources)) {
			for (const [match, arg] of live(src).matchAll(
				/\sv-safe-html(?::([a-z]+))?=/g
			)) {
				if (!arg || !KNOWN.includes(arg))
					offenders.push(`${path} ${match.trim()}`)
			}
		}
		expect(offenders, offenders.join('\n')).toEqual([])
	})
})
