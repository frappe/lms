import { createApp, h } from 'vue'
import { Code } from 'lucide-vue-next'
import translationPlugin from '@/translation'
import ProgrammingExerciseModal from '@/pages/ProgrammingExercises/ProgrammingExerciseModal.vue';
import { call } from 'frappe-ui';
import { usersStore } from '@/stores/user'


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
                this.wrapper.innerHTML = `<iframe src="/lms/exercises/${exercise}/submission/${submission}?fromLesson=1" class="w-full h-[900px] border rounded-md"></iframe>`
            })
            return
        } 
        call("frappe.client.get_value", {
            doctype: 'LMS Programming Exercise',
            name: exercise,
            fieldname: "title"
        }).then((data: { title: string }) => {
            this.wrapper.innerHTML = `<div class='border rounded-md p-4 text-center bg-surface-menu-bar mb-4'>
                <span class="font-medium">
                    Programming Exercise: ${data.title}
                </span>
            </div>`
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