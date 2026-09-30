import { createApp, h, markRaw } from 'vue'
import type { App } from 'vue'
import { registerDirectives } from '@/directives'
import { Code } from 'lucide-vue-next'
import translationPlugin from '@/translation'
import ProgrammingExerciseModal from '@/components/Modals/ProgrammingExerciseModal.vue'
import { call } from 'frappe-ui'
import { usersStore } from '@/stores/user'
import { mountBlock, mountPreview } from '@/utils/blockMount'
import AssessmentBlock from '@/components/Assessment/AssessmentBlock.vue'
import ProgrammingExerciseSubmission from '@/pages/ProgrammingExercises/ProgrammingExerciseSubmission.vue'

export class Program {
	data: any
	api: any
	readOnly: boolean
	wrapper!: HTMLDivElement
	app: App | null = null
	destroyed = false
	studentView: boolean

	constructor({
		data,
		api,
		readOnly,
		config,
	}: {
		data: any
		api: any
		readOnly: boolean
		config?: { studentView?: boolean }
	}) {
		this.data = data
		this.api = api
		this.readOnly = readOnly
		// The block is its own Vue app, outside the lesson's provide/inject, so
		// Student View reaches it through the tool config.
		this.studentView = Boolean(config?.studentView)
	}

	static get toolbox() {
		const app = createApp({
			render: () => h(Code, { size: 5, strokeWidth: 1.5 }),
		})
		registerDirectives(app)

		const div = document.createElement('div')
		app.mount(div)

		return {
			title: __('Programming Exercise'),
			icon: div.innerHTML,
		}
	}

	static get isReadOnlySupported() {
		return true
	}

	render() {
		this.wrapper = document.createElement('div')
		this.wrapper.className = 'not-prose my-5'
		if (Object.keys(this.data).length) {
			this.renderExercise(this.data.exercise)
		} else {
			this.renderModal()
		}
		return this.wrapper
	}

	renderModal() {
		if (this.readOnly) {
			return
		}
		const app = createApp(ProgrammingExerciseModal, {
			onSave: (exercise: string) => {
				this.data.exercise = exercise
				this.renderExercise(exercise)
			},
		})
		registerDirectives(app)
		app.use(translationPlugin)
		app.mount(this.wrapper)
	}

	renderExercise(exercise: string) {
		if (this.readOnly) {
			const { userResource } = usersStore()
			call<{ name?: string } | null>('frappe.client.get_value', {
				doctype: 'LMS Programming Exercise Submission',
				filters: {
					exercise: exercise,
					member: userResource.data?.name,
				},
				fieldname: ['name'],
			})
				.catch(() => null)
				.then((data) => {
					// The block can be destroyed before the lookup answers.
					if (this.destroyed) return
					this.mountSubmission(exercise, data?.name || 'new')
				})
			return
		}
		this.app = mountPreview(this.wrapper, 'exercise', exercise)
	}

	mountSubmission(exercise: string, submissionID: string): void {
		this.app = mountBlock(this.wrapper, AssessmentBlock, {
			is: markRaw(ProgrammingExerciseSubmission),
			props: {
				exerciseID: exercise,
				submissionID,
				studentView: this.studentView,
			},
			studentView: this.studentView,
		})
	}

	destroy(): void {
		this.destroyed = true
		this.app?.unmount()
		this.app = null
	}

	save() {
		if (!this.data.exercise) return {}
		return {
			exercise: this.data.exercise,
		}
	}
}
