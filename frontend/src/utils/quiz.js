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
			this.wrapper.innerHTML = `<iframe src="/lms/quiz/${quiz}?fromLesson=1" class="w-full h-[500px]"></iframe>`
			return
		}
		this.wrapper.innerHTML = `<div class='border rounded-md p-4 text-center bg-surface-menu-bar mb-4'>
            <span class="font-medium">
                Quiz: ${quiz}
            </span>
        </div>`
		return
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
		app.mount(this.wrapper)
	}

	save() {
		if (Object.keys(this.data).length === 0) return {}
		return {
			quiz: this.data.quiz,
		}
	}
}
