// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { parse } from '@vue/compiler-sfc'
import { NodeTypes, type ElementNode } from '@vue/compiler-core'

// Every route form closes the same way: FormShell emits close on the mobile
// back control and on a desktop Dialog dismiss (FormShell.test.ts), and
// useFormRoute's close() pops the entry it opened (useFormRoute.test.ts).
// What is left per form is the wiring between the two, checked here instead
// of mounting each form to press back.
const sources = import.meta.glob('../pages/**/*.vue', {
	query: '?raw',
	import: 'default',
	eager: true,
}) as Record<string, string>

const forms = Object.entries(sources).filter(([, src]) =>
	/<FormShell[\s>]/.test(src)
)
const formName = (path: string) => path.split('/').pop()!.replace('.vue', '')
const script = (src: string) => parse(src).descriptor.scriptSetup!.content

const shellOf = (src: string) =>
	parse(src).descriptor.template!.ast!.children.find(
		(node) => node.type === NodeTypes.ELEMENT && node.tag === 'FormShell'
	) as ElementNode | undefined

const closeHandler = (shell: ElementNode | undefined) => {
	const listener = shell?.props.find(
		(prop) =>
			prop.type === NodeTypes.DIRECTIVE &&
			prop.name === 'on' &&
			prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION &&
			prop.arg.content === 'close'
	)
	return listener?.type === NodeTypes.DIRECTIVE &&
		listener.exp?.type === NodeTypes.SIMPLE_EXPRESSION
		? listener.exp.content
		: undefined
}

describe('route form wiring', () => {
	it('finds the route forms', () => {
		expect(forms.length).toBeGreaterThan(10)
	})

	it.each(forms.map(([path, src]) => ({ form: formName(path), src })))(
		'$form closes FormShell through useFormRoute',
		({ src }) => {
			expect(closeHandler(shellOf(src))).toBe('close')
			expect(script(src)).toMatch(
				/const\s*\{[^}]*\bclose\b[^}]*\}\s*=\s*useFormRoute\(/
			)
		}
	)

	// A push on save would leave the form as the entry Back returns to.
	it.each(['AssignmentForm', 'ChapterForm', 'ProgramForm'])(
		'%s saves through saveAndReplace, never a push',
		(name) => {
			const [, src] = forms.find(([path]) => formName(path) === name)!
			expect(script(src)).toContain('saveAndReplace(')
			expect(script(src)).not.toMatch(/router\.(push|replace)\(/)
		}
	)
})
