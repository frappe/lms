import { Pencil } from 'lucide-vue-next'
import { registerDirectives } from '@/directives'
import { createApp, h, markRaw } from 'vue'
import type { App } from 'vue'
import type { BlockAPI } from '@editorjs/editorjs'
import AssessmentPlugin from '@/components/AssessmentPlugin.vue'
import translationPlugin from '../translation'
import { call } from 'frappe-ui'
import router from '@/router'
import { mountBlock, mountPreview } from '@/utils/blockMount'
import AssessmentBlock from '@/components/Assessment/AssessmentBlock.vue'
import AssignmentCard from '@/components/Assignment.vue'

type AssignmentData = { assignment?: string }

export class Assignment {
	data: AssignmentData
	readOnly: boolean
	studentView: boolean
	block?: BlockAPI
	wrapper!: HTMLDivElement
	app: App | null = null
	destroyed = false

	constructor({
		data,
		readOnly,
		config,
		block,
	}: {
		data: AssignmentData
		api?: unknown
		readOnly: boolean
		config?: { studentView?: boolean }
		block?: BlockAPI
	}) {
		this.data = data
		this.readOnly = readOnly
		this.block = block
		this.studentView = Boolean(config?.studentView)
	}

	static get toolbox() {
		const app = createApp({
			render: () => h(Pencil, { size: 18, strokeWidth: 1.5 }),
		})
		registerDirectives(app)

		const div = document.createElement('div')
		app.mount(div)

		return {
			title: __('Assignment'),
			icon: div.innerHTML,
		}
	}

	static get isReadOnlySupported() {
		return true
	}

	render(): HTMLDivElement {
		this.wrapper = document.createElement('div')
		this.wrapper.className = 'not-prose my-5'
		if (Object.keys(this.data).length) {
			this.renderAssignment(this.data.assignment as string)
		} else {
			this.renderAssignmentModal()
		}
		return this.wrapper
	}

	renderAssignment(assignment: string): void {
		if (this.readOnly) {
			// The block can be destroyed before the lookup answers.
			const renderSubmission = (submission: string | null | undefined) => {
				if (this.destroyed) return
				this.mountSubmission(assignment, submission || 'new')
			}
			call<string | null>('lms.lms.api.get_own_assignment_submission', {
				assignment: assignment,
			})
				.then(renderSubmission)
				.catch(() => renderSubmission('new'))
			return
		}
		this.app = mountPreview(this.wrapper, 'assignment', assignment)
	}

	mountSubmission(assignment: string, submissionName: string): void {
		this.app = mountBlock(this.wrapper, AssessmentBlock, {
			is: markRaw(AssignmentCard),
			props: {
				assignmentID: assignment,
				submissionName,
				showTitle: false,
			},
			// AssessmentBlock shadows $user for the card, which is how the
			// card's instructor-only affordances stay hidden in Student View.
			studentView: this.studentView,
		})
	}

	destroy(): void {
		this.destroyed = true
		this.app?.unmount()
		this.app = null
	}

	renderAssignmentModal(): void {
		if (this.readOnly) {
			return
		}
		const app = createApp(AssessmentPlugin, {
			type: 'assignment',
			onAddition: (assignment: string) => {
				this.data.assignment = assignment
				this.app?.unmount()
				this.renderAssignment(assignment)
				this.block?.dispatchChange()
			},
		})
		registerDirectives(app)
		app.use(translationPlugin)
		app.use(router)
		app.mount(this.wrapper)
		this.app = app
	}

	save(): AssignmentData {
		if (Object.keys(this.data).length === 0) return {}
		return {
			assignment: this.data.assignment,
		}
	}
}
