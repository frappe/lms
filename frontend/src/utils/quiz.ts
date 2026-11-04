import QuizBlock from '@/components/QuizBlock.vue'
import { registerDirectives } from '@/directives'
import AssessmentPlugin from '@/components/AssessmentPlugin.vue'
import { createApp, h } from 'vue'
import type { App } from 'vue'
import translationPlugin from '../translation'
import { CircleHelp } from 'lucide-vue-next'
import router from '@/router'
import { mountBlock, mountPreview } from '@/utils/blockMount'

type QuizData = { quiz?: string }

export class Quiz {
	data: QuizData
	readOnly: boolean
	wrapper!: HTMLDivElement
	quizApp: App | null = null

	constructor({ data, readOnly }: { data: QuizData; readOnly: boolean }) {
		this.data = data
		this.readOnly = readOnly
	}

	static get toolbox() {
		const app = createApp({
			render: () => h(CircleHelp, { size: 5, strokeWidth: 1.5 }),
		})
		registerDirectives(app)

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

	render(): HTMLDivElement {
		this.wrapper = document.createElement('div')
		this.wrapper.className = 'not-prose my-5'
		if (Object.keys(this.data).length) {
			this.renderQuiz(this.data.quiz as string)
		} else {
			this.renderQuizModal()
		}
		return this.wrapper
	}

	renderQuiz(quiz: string): void {
		this.quizApp = this.readOnly
			? mountBlock(this.wrapper, QuizBlock, { quiz })
			: mountPreview(this.wrapper, 'quiz', quiz)
	}

	// Tear down the inline quiz app when EditorJS removes the block so the mount
	// doesn't leak after the lesson view is destroyed.
	destroy(): void {
		this.quizApp?.unmount()
		this.quizApp = null
	}

	renderQuizModal(): void {
		if (this.readOnly) {
			return
		}
		const app = createApp(AssessmentPlugin, {
			type: 'quiz',
			onAddition: (quiz: string) => {
				this.data.quiz = quiz
				this.renderQuiz(quiz)
			},
		})
		registerDirectives(app)
		app.use(translationPlugin)
		app.use(router)
		app.mount(this.wrapper)
	}

	save(): QuizData {
		if (Object.keys(this.data).length === 0) return {}
		return {
			quiz: this.data.quiz,
		}
	}
}
