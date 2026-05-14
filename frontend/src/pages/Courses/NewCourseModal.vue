<template>
	<Dialog
		v-model="show"
		:options="{
			title: __('New Course'),
			size: '3xl',
		}"
	>
		<template #body-content>
			<div class="text-base">
				<div class="grid grid-cols-2 gap-5 border-b mb-5">
					<FormControl
						v-model="course.title"
						:label="__('Title')"
						:required="true"
						autocomplete="off"
					/>
					<Link
						v-model="course.category"
						doctype="LMS Category"
						:label="__('Category')"
						:inlineCreate="true"
						:onCreate="createCategory"
					/>
					<MultiSelect
						v-model="course.instructors"
						doctype="User"
						:label="__('Instructors')"
						url="lms.lms.api.search_users_by_role"
						:searchParams="{
							roles: JSON.stringify(['Course Creator', 'Batch Evaluator']),
						}"
						:onCreate="() => (showMemberModal = true)"
						:required="true"
					/>
					<Uploader
						v-model="course.image"
						:label="__('Course Image')"
						:required="false"
					/>
				</div>
				<div class="space-y-4">
					<FormControl
						v-model="course.short_introduction"
						:label="__('Short Introduction')"
						type="textarea"
						:required="true"
						:rows="4"
					/>
					<div class="">
						<div class="mb-1.5 text-sm text-ink-gray-5">
							{{ __('Course Description') }}
							<span class="text-ink-red-3">*</span>
						</div>
						<TextEditor
							:content="course.description"
							@change="(val: string) => (course.description = val)"
							:editable="true"
							:fixedMenu="true"
							editorClass="prose-sm max-w-none border-b border-x border-outline-gray-modals bg-surface-gray-2 rounded-b-md py-1 px-2 min-h-[10rem] max-h-[17rem] overflow-auto"
						/>
					</div>
				</div>
			</div>
		</template>
		<template #actions="{ close }">
			<div class="text-end">
				<Button variant="solid" @click="saveCourse(close)">
					{{ __('Save') }}
				</Button>
			</div>
		</template>
	</Dialog>
	<NewMemberModal
		v-model="showMemberModal"
		:defaultRoles="['course_creator']"
		@created="onInstructorCreated"
	/>
</template>
<script setup lang="ts">
import { Button, Dialog, FormControl, TextEditor, toast } from 'frappe-ui'
import { useOnboarding, useTelemetry } from 'frappe-ui/frappe'
import { inject, onMounted, onBeforeUnmount, ref } from 'vue'
import { useRouter } from 'vue-router'
import Link from '@/components/Controls/Link.vue'
import { cleanError, sanitizeHTML, createLMSCategory } from '@/utils'
import MultiSelect from '@/components/Controls/MultiSelect.vue'
import Uploader from '@/components/Controls/Uploader.vue'
import NewMemberModal from '@/components/Modals/NewMemberModal.vue'

const show = defineModel<boolean>({ required: true, default: false })
const router = useRouter()
const { capture } = useTelemetry()
const { updateOnboardingStep } = useOnboarding('learning')
const user = inject<any>('$user')
const courseCreated = ref(false)
const showMemberModal = ref(false)

const props = defineProps<{
	courses: any
}>()

type Course = {
	title: string
	short_introduction: string
	description: string
	instructors: string[]
	category: string | null
	image: string | null
}

const course = ref<Course>({
	title: '',
	short_introduction: '',
	description: '',
	instructors: [],
	category: null,
	image: null,
})

const createCategory = (name: string, done: () => void) => {
	createLMSCategory(name).then((categoryName: string) => {
		if (!categoryName) return
		course.value.category = categoryName
		done()
	})
}

const onInstructorCreated = (user: any) => {
	course.value.instructors = [...course.value.instructors, user.name]
}

const validateFields = () => {
	Object.keys(course.value).forEach((key) => {
		if (typeof course.value[key as keyof Course] === 'string') {
			course.value[key as keyof Course] = sanitizeHTML(
				course.value[key as keyof Course] as string
			)
		}
	})
}

const saveCourse = (close: () => void = () => {}) => {
	validateFields()
	props.courses.insert.submit(
		{
			...course.value,
			instructors: course.value.instructors.map((instructor) => ({
				instructor: instructor,
			})),
		},
		{
			onSuccess(data: any) {
				toast.success(__('Course created successfully'))
				close()
				capture('course_created')
				courseCreated.value = true
				router.push({
					name: 'CourseDetail',
					params: { courseName: data.name },
					hash: '#settings',
				})
				if (user.data?.is_system_manager) {
					updateOnboardingStep('create_first_course', true, false, () => {
						localStorage.setItem('firstCourse', data.name)
					})
				}
			},
			onError(err: any) {
				toast.error(cleanError(err.messages?.[0]))
				console.error(err)
			},
		}
	)
}

const keyboardShortcut = (e: KeyboardEvent) => {
	if (
		e.key === 's' &&
		(e.ctrlKey || e.metaKey) &&
		e.target &&
		e.target instanceof HTMLElement &&
		!e.target.classList.contains('ProseMirror')
	) {
		saveCourse()
		e.preventDefault()
	}
}

onMounted(() => {
	window.addEventListener('keydown', keyboardShortcut)
	capture('course_form_opened')
})

onBeforeUnmount(() => {
	window.removeEventListener('keydown', keyboardShortcut)
	if (!courseCreated.value) {
		capture('course_form_closed', {
			data: course.value,
		})
	}
})
</script>
