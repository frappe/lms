<template>
	<Dialog v-model="show" :options="{ title: dialogTitle, size: 'lg' }">
		<template #body-content>
			<div class="space-y-4">
				<FormControl
					v-model="lesson.title"
					:label="__('Title')"
					:required="true"
					autocomplete="off"
					@keyup.enter="submit"
				/>
				<Switch
					v-model="lesson.include_in_preview"
					:label="__('Include in Preview')"
					:description="
						__(
							'If enabled, the lesson will also be accessible to users who are not enrolled in the course.'
						)
					"
				/>
			</div>
		</template>
		<template #actions>
			<Button variant="solid" class="w-full" :loading="saving" @click="submit">
				{{ isEdit ? __('Save') : __('Create') }}
			</Button>
		</template>
	</Dialog>
</template>

<script setup lang="ts">
import { Dialog, FormControl, Button, createResource, toast } from 'frappe-ui'
import Switch from '@/components/Controls/Switch.vue'
import { computed, reactive, ref, watch } from 'vue'
import { useTelemetry } from 'frappe-ui/frappe'

interface LessonDetail {
	name?: string
	title?: string
	include_in_preview?: boolean | 0 | 1
}

interface LessonForm {
	title: string
	include_in_preview: 0 | 1
}

const props = defineProps<{
	course: string
	chapterName: string
	lessonIdx: number
	lessonDetail?: LessonDetail | null
}>()

const emit = defineEmits<{
	created: [{ name: string; number: string }]
	updated: [{ name: string }]
}>()

const show = defineModel<boolean>('show', { default: false })
const { capture } = useTelemetry()

const saving = ref<boolean>(false)

const lesson = reactive<LessonForm>({
	title: '',
	include_in_preview: 0,
})

const isEdit = computed<boolean>(() => Boolean(props.lessonDetail?.name))
const dialogTitle = computed<string>(() =>
	isEdit.value ? __('Edit lesson') : __('New lesson')
)

const fetchLesson = createResource({
	url: 'frappe.client.get_value',
	makeParams: () => ({
		doctype: 'Course Lesson',
		filters: { name: props.lessonDetail?.name },
		fieldname: ['title', 'include_in_preview'],
	}),
	onSuccess(data: { title?: string; include_in_preview?: 0 | 1 } | undefined) {
		if (!data) return
		if (data.title != null) lesson.title = data.title
		lesson.include_in_preview = data.include_in_preview ? 1 : 0
	},
})

watch(
	() => [show.value, props.lessonDetail] as const,
	([open, detail]) => {
		if (!open) return
		lesson.title = detail?.title ?? ''
		lesson.include_in_preview = detail?.include_in_preview ? 1 : 0
		// Outline rows don't carry include_in_preview — hydrate from the doc
		// so the toggle reflects current state instead of always off.
		if (detail?.name) fetchLesson.reload()
	},
	{ immediate: true }
)

const errorMessage = (err: { messages?: string[] } | string): string =>
	typeof err === 'string' ? err : err.messages?.[0] ?? 'Error'

const insertLesson = createResource({
	url: 'frappe.client.insert',
	makeParams: () => ({
		doc: {
			doctype: 'Course Lesson',
			course: props.course,
			chapter: props.chapterName,
			title: lesson.title,
			include_in_preview: lesson.include_in_preview,
		},
	}),
})

const insertReference = createResource({
	url: 'frappe.client.insert',
	makeParams: (values: { lesson: string }) => ({
		doc: {
			doctype: 'Lesson Reference',
			parent: props.chapterName,
			parenttype: 'Course Chapter',
			parentfield: 'lessons',
			lesson: values.lesson,
			idx: props.lessonIdx,
		},
	}),
})

const updateLesson = createResource({
	url: 'frappe.client.set_value',
	makeParams: () => ({
		doctype: 'Course Lesson',
		name: props.lessonDetail?.name,
		fieldname: {
			title: lesson.title,
			include_in_preview: lesson.include_in_preview,
		},
	}),
})

function validate(): string | undefined {
	if (!lesson.title.trim()) return __('Title is required')
	return undefined
}

function submit() {
	const err = validate()
	if (err) {
		toast.error(err)
		return
	}
	saving.value = true
	if (isEdit.value) {
		updateLesson.submit(
			{},
			{
				onSuccess() {
					saving.value = false
					toast.success(__('Lesson updated'))
					emit('updated', { name: props.lessonDetail!.name! })
					show.value = false
				},
				onError(err: { messages?: string[] } | string) {
					saving.value = false
					toast.error(errorMessage(err))
				},
			}
		)
		return
	}
	insertLesson.submit(
		{},
		{
			onSuccess(data: { name: string }) {
				insertReference.submit(
					{ lesson: data.name },
					{
						onSuccess() {
							saving.value = false
							capture('lesson_created')
							toast.success(__('Lesson created'))
							emit('created', {
								name: data.name,
								number: `${props.lessonIdx}`,
							})
							show.value = false
						},
						onError(err: { messages?: string[] } | string) {
							saving.value = false
							toast.error(errorMessage(err))
						},
					}
				)
			},
			onError(err: { messages?: string[] } | string) {
				saving.value = false
				toast.error(errorMessage(err))
			},
		}
	)
}
</script>
