import QuizBlock from '@/components/QuizBlock.vue'
import { createApp } from 'vue'
import { usersStore } from '../stores/user'
import translationPlugin from '../translation'

export class Quiz {
	constructor({ data, api, readOnly }) {
		this.data = data
		this.readOnly = readOnly
	}

	static get isReadOnlySupported() {
		return true
	}

	render() {
		this.wrapper = document.createElement('div')
		if (this.data) {
			let renderedQuiz = this.renderQuiz(this.data.quiz)
			if (!this.readOnly) {
				this.wrapper.innerHTML = renderedQuiz
			}
		}
		return this.wrapper
	}

	renderQuiz(quiz) {
		if (this.readOnly) {
			const app = createApp(QuizBlock, {
				quiz: quiz, // Pass quiz content as prop
			})
			app.use(translationPlugin)
			const { userResource } = usersStore()
			app.provide('$user', userResource)
			app.mount(this.wrapper)
			return
		}
		return `<div class='border rounded-md p-10 text-center mb-2'>
            <span class="font-medium">
                Quiz: ${quiz}
            </span>
        </div>`
	}

	save(blockContent) {
		return {
			quiz: this.data.quiz,
		}
	}
}
