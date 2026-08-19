import { Pencil } from 'lucide-vue-next'
import { registerDirectives } from '@/directives'
import { createApp, h } from 'vue'
import AssessmentPlugin from '@/components/AssessmentPlugin.vue'
import translationPlugin from '../translation'
import { call } from 'frappe-ui'
import router from '@/router'
import { getLmsRoute } from '@/utils/basePath'
import { blockNotice, embedFrame } from '@/utils/blockDom'

export class Assignment {
	constructor({ data, api, readOnly, config }) {
		this.data = data
		this.readOnly = readOnly
		this.studentView = Boolean(config?.studentView)
	}

	static get toolbox() {
		const app = createApp({
			render: () =>
				h(Pencil, { size: 18, strokeWidth: 1.5, color: 'black' }),
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

	render() {
		this.wrapper = document.createElement('div')
		if (Object.keys(this.data).length) {
			this.renderAssignment(this.data.assignment)
		} else {
			this.renderAssignmentModal()
		}
		return this.wrapper
	}

	renderAssignment(assignment) {
		if (this.readOnly) {
			const renderSubmission = (submission) => {
				// The iframe is its own app instance, so Student View has to
				// travel in the URL rather than through provide/inject.
				const studentView = this.studentView ? '&studentView=1' : ''
				const submissionPath = getLmsRoute(
					`assignment-submission/${assignment}/${
						submission || 'new'
					}?fromLesson=1${studentView}`
				)
				const frame = embedFrame(submissionPath, {
					class: 'w-full h-[500px]',
				})
				this.wrapper.replaceChildren(...(frame ? [frame] : []))
			}
			call('lms.lms.api.get_own_assignment_submission', {
				assignment: assignment,
			})
				.then(renderSubmission)
				.catch(() => renderSubmission('new'))
			return
		}
		call('frappe.client.get_value', {
			doctype: 'LMS Assignment',
			filters: {
				name: assignment,
			},
			fieldname: ['title'],
		}).then((data) => {
			this.wrapper.replaceChildren(
				blockNotice(`Assignment: ${data.title}`)
			)
			return
		})
	}

	renderAssignmentModal() {
		if (this.readOnly) {
			return
		}
		const app = createApp(AssessmentPlugin, {
			type: 'assignment',
			onAddition: (assignment) => {
				this.data.assignment = assignment
				this.renderAssignment(assignment)
			},
		})
		registerDirectives(app)
		app.use(translationPlugin)
		app.use(router)
		app.mount(this.wrapper)
	}

	save() {
		if (Object.keys(this.data).length === 0) return {}
		return {
			assignment: this.data.assignment,
		}
	}
}
