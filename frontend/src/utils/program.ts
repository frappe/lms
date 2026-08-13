import { createApp, h } from 'vue'
import { registerDirectives } from '@/directives'
import { Code } from 'lucide-vue-next'
import translationPlugin from '@/translation'
import ProgrammingExerciseModal from '@/components/Modals/ProgrammingExerciseModal.vue'
import { call } from 'frappe-ui'
import { usersStore } from '@/stores/user'
import { getLmsRoute } from '@/utils/basePath'
import { blockNotice, embedFrame } from '@/utils/blockDom'

export class Program {
	data: any
	api: any
	readOnly: boolean
	wrapper: HTMLDivElement

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
		// The submission renders in an iframe (its own Vue app), so the
		// preview's provide/inject can't reach it. Same mechanism as the
		// assignment tool: the flag travels in the URL.
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
			call('frappe.client.get_value', {
				doctype: 'LMS Programming Exercise Submission',
				filters: {
					exercise: exercise,
					member: userResource.data?.name,
				},
				fieldname: ['name'],
			}).then((data: { name: string }) => {
				let submission = data.name || 'new'
				const studentView = this.studentView ? '&studentView=1' : ''
				const submissionPath = getLmsRoute(
					`programming-exercises/${exercise}/submission/${submission}?fromLesson=1${studentView}`
				)
				const frame = embedFrame(submissionPath, {
					class: 'w-full h-[900px] border rounded-md',
				})
				this.wrapper.replaceChildren(...(frame ? [frame] : []))
			})
			return
		}
		call('frappe.client.get_value', {
			doctype: 'LMS Programming Exercise',
			filters: {
				name: exercise,
			},
			fieldname: 'title',
		}).then((data: { title: string }) => {
			this.wrapper.replaceChildren(
				blockNotice(`Programming Exercise: ${data.title}`)
			)
			return
		})
	}

	save() {
		if (!this.data.exercise) return {}
		return {
			exercise: this.data.exercise,
		}
	}
}
