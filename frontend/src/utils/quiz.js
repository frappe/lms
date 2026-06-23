import QuizBlock from '@/components/QuizBlock.vue'
import AssessmentPlugin from '@/components/AssessmentPlugin.vue'
import { createApp, h } from 'vue'
import { usersStore } from '../stores/user'
import translationPlugin from '../translation'
import { CircleHelp } from 'lucide-vue-next'
import router from '@/router'

export class Quiz {
	constructor({ data, api, readOnly }) {
		this.data = data
		this.readOnly = readOnly
	}

	static get toolbox() {
		const app = createApp({
			render: () => h(CircleHelp, { size: 5, strokeWidth: 1.5 }),
		})

		const div = document.createElement('div')
		app.mount(div)

		return {
			title: __('Quiz'),
			icon: div.innerHTML,
		}
	}

	static get isReadOnlySupported() {
		return true
	}

	render() {
		this.wrapper = document.createElement('div')
		if (Object.keys(this.data).length) {
			this.renderQuiz(this.data.quiz)
		} else {
			this.renderQuizModal()
		}
		return this.wrapper
	}

	renderQuiz(quiz) {
		if (this.readOnly) {
			// Mount the quiz inline instead of loading the whole SPA in an iframe
			// (which flashed the app shell/sidebar before the quiz appeared). It's
			// a standalone mount — EditorJS blocks live outside the app's Vue tree —
			// so give it translation and the shared $user the quiz component needs.
			const { userResource } = usersStore()
			this.quizApp = createApp(QuizBlock, { quiz })
			this.quizApp.use(translationPlugin)
			this.quizApp.provide('$user', userResource)
			// Contain quiz render/runtime errors to this mount. Inline (unlike
			// the old iframe) the quiz shares the lesson's render tree, so an
			// uncaught error here would otherwise propagate through EditorJS and
			// blank the whole lesson.
			this.quizApp.config.errorHandler = (err) => {
				console.error('[lms] in-lesson quiz failed to render', err)
			}
			this.quizApp.mount(this.wrapper)
			return
		}
		this.wrapper.innerHTML = `<div class='border rounded-md p-4 text-center bg-surface-sidebar mb-4'>
            <span class="font-medium">
                Quiz: ${quiz}
            </span>
        </div>`
		return
	}

	// Tear down the inline quiz app when EditorJS removes the block so the mount
	// doesn't leak after the lesson view is destroyed.
	destroy() {
		this.quizApp?.unmount()
	}

	renderQuizModal() {
		if (this.readOnly) {
			return
		}
		const app = createApp(AssessmentPlugin, {
			type: 'quiz',
			onAddition: (quiz) => {
				this.data.quiz = quiz
				this.renderQuiz(quiz)
			},
		})
		app.use(translationPlugin)
		app.use(router)
		app.mount(this.wrapper)
	}

	save() {
		if (Object.keys(this.data).length === 0) return {}
		return {
			quiz: this.data.quiz,
		}
	}
}
