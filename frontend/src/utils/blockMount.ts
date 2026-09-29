import { createApp } from 'vue'
import type { App, Component } from 'vue'
import { registerDirectives } from '@/directives'
import { usersStore } from '@/stores/user'
import translationPlugin from '@/translation'
import AssessmentBlockPreview from '@/components/Assessment/AssessmentBlockPreview.vue'
import type { PreviewKind } from '@/components/Assessment/AssessmentBlockPreview.vue'

const ASSESSMENT_BLOCK_ATTRIBUTE = 'data-assessment-block'
export const ASSESSMENT_BLOCK_SELECTOR = `[${ASSESSMENT_BLOCK_ATTRIBUTE}]`

interface MountBlockOptions {
	preview?: boolean
}

let mountedBlocks = 0

const markBlock = (el: HTMLElement, preview: boolean): void => {
	el.setAttribute(ASSESSMENT_BLOCK_ATTRIBUTE, '')
	el.classList.add('not-prose', 'my-5')
	// An editor preview renders at full strength; `inert` keeps focus, clicks and
	// shortcuts out of it.
	el.toggleAttribute('inert', preview)
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
	app.mount(el)
	return app
}

// The lesson editor shows a static summary of the block, not the learner's
// component: no attempts, submissions or code runner to load.
export const mountPreview = (
	el: HTMLElement,
	kind: PreviewKind,
	name: string
): App =>
	mountBlock(el, AssessmentBlockPreview, { kind, name }, { preview: true })
