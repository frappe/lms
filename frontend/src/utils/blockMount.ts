import { createApp } from 'vue'
import type { App, Component } from 'vue'
import { registerDirectives } from '@/directives'
import { usersStore } from '@/stores/user'
import translationPlugin from '@/translation'

const ASSESSMENT_BLOCK_ATTRIBUTE = 'data-assessment-block'
export const ASSESSMENT_BLOCK_SELECTOR = `[${ASSESSMENT_BLOCK_ATTRIBUTE}]`

interface MountBlockOptions {
	preview?: boolean
}

let mountedBlocks = 0

const markBlock = (el: HTMLElement, preview: boolean): void => {
	el.setAttribute(ASSESSMENT_BLOCK_ATTRIBUTE, '')
	el.classList.add('not-prose', 'my-5')
	el.toggleAttribute('inert', preview)
}

// An editor preview renders the block as the learner sees it, dimmed under an
// overlay. `inert` on the wrapper keeps focus, clicks and shortcuts out of it.
const previewHost = (el: HTMLElement): HTMLElement => {
	el.classList.add('relative')
	const host = document.createElement('div')
	const overlay = document.createElement('div')
	overlay.className = 'absolute inset-0 bg-surface-base opacity-50'
	overlay.setAttribute('data-testid', 'block-preview-overlay')
	overlay.setAttribute('aria-hidden', 'true')
	el.replaceChildren(host, overlay)
	return host
}

// EditorJS blocks render outside the lesson's Vue tree, so each is its own app
// and inherits none of main.js's plugins.
export function mountBlock(
	el: HTMLElement,
	component: Component,
	props: Record<string, unknown>,
	{ preview = false }: MountBlockOptions = {}
): App {
	markBlock(el, preview)
	const app = createApp(component, props)
	// useId() counts per app, so without a prefix two blocks hand out the same ids.
	app.config.idPrefix = `block-${++mountedBlocks}`
	registerDirectives(app)
	app.use(translationPlugin)
	app.provide('$user', usersStore().userResource)
	// Inline, a render error would otherwise propagate through EditorJS and
	// blank the whole lesson.
	app.config.errorHandler = (err: unknown) => {
		console.error('[lms] in-lesson block failed to render', err)
	}
	app.mount(preview ? previewHost(el) : el)
	return app
}
