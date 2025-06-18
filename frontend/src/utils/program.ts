import { createApp, h } from 'vue'
import { Code } from 'lucide-vue-next'
import translationPlugin from '@/translation'
import ProgrammingExerciseModal from '@/components/Modals/ProgrammingExerciseModal.vue';

export class Program {

    data: any;
    api: any;
    readOnly: boolean;
    wrapper: HTMLDivElement;

    constructor({ data, api, readOnly }: { data: any; api: any; readOnly: boolean }) {
        this.data = data;
        this.api = api;
        this.readOnly = readOnly;
    }

    static get toolbox() {
        const app = createApp({
            render: () => h(Code, { size: 5, strokeWidth: 1.5 }),
        })

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
		app.use(translationPlugin)
		app.mount(this.wrapper)
    }

    renderExercise(exercise: string) {
        this.wrapper.innerHTML = `<div class='border rounded-md p-10 text-center bg-surface-menu-bar mb-2'>
            <span class="font-medium">
                Programming Exercise: ${exercise}
            </span>
        </div>`
		return
    }

    save() {
		return {
			exercise: this.data.exercise,
		}
	}
}