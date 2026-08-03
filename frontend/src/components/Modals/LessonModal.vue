<template>
	<Dialog v-model:open="show" :title="dialogTitle" size="lg">
		<template #default>
			<div class="space-y-4">
				<FormControl
					v-model="lesson.title"
					:label="__('Title')"
					:required="true"
					autocomplete="off"
					@keyup.enter="submit"
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
import { computed, reactive, ref, watch } from 'vue'
import { resourceErrorMessage, submitResource } from '@/utils/resource'
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
// Set once frappe.client.insert has created the Course Lesson. The reference
// insert that follows is a separate request, and if it fails the dialog stays
// open — retrying must attach a reference to that same lesson, not create a
// second one.
const createdLesson = ref<string | null>(null)
// The title that lesson was created with, so a retry can tell if it changed.
const createdTitle = ref<string>('')

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
		fieldname: ['title'],
	}),
	onSuccess(data: { title?: string } | undefined) {
		if (!data) return
		if (data.title != null) lesson.title = data.title
	},
})

watch(
	() => [show.value, props.lessonDetail] as const,
	([open, detail]) => {
		if (!open) return
		createdLesson.value = null
		createdTitle.value = ''
		lesson.title = detail?.title ?? ''
		// Refresh the title from the doc in case the outline row is stale.
		if (detail?.name) fetchLesson.reload()
	},
	{ immediate: true }
)

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

// Renames the lesson created by a previous, half-failed attempt. Distinct from
// updateLesson, which targets props.lessonDetail and does not exist on a create.
const renameCreatedLesson = createResource({
	url: 'frappe.client.set_value',
	makeParams: () => ({
		doctype: 'Course Lesson',
		name: createdLesson.value,
		fieldname: { title: lesson.title },
	}),
})

const updateLesson = createResource({
	url: 'frappe.client.set_value',
	makeParams: () => ({
		doctype: 'Course Lesson',
		name: props.lessonDetail?.name,
		fieldname: {
			title: lesson.title,
		},
	}),
})

function validate(): string | undefined {
	if (!lesson.title.trim()) return __('Title is required')
	return undefined
}

function submit() {
	// frappe-ui's Dialog does not disable the action while the returned promise
	// is pending, so a double-click would otherwise start a second insert.
	if (saving.value) return
	const err = validate()
	if (err) {
		toast.error(err)
		return
	}
	saving.value = true
	const done = isEdit.value ? saveLesson() : createLesson()
	// One place clears the flag, so a bug thrown from a success handler cannot
	// leave the button spinning forever.
	return done.finally(() => {
		saving.value = false
	})
}

function saveLesson() {
	return submitResource(
		updateLesson,
		{},
		{
			onSuccess() {
				toast.success(__('Lesson updated'))
				emit('updated', { name: props.lessonDetail!.name! })
				show.value = false
			},
			onError(err: unknown) {
				toast.error(resourceErrorMessage(err))
			},
		}
	)
}

function createLesson() {
	// A previous attempt already created the lesson and failed on the reference.
	// Re-inserting would duplicate it, but the user may well have edited the
	// title before retrying — believing that is what failed — so carry it over
	// rather than silently discarding it and reporting success.
	if (createdLesson.value) {
		const name = createdLesson.value
		if (lesson.title.trim() === createdTitle.value) return linkLesson(name)
		return submitResource(
			renameCreatedLesson,
			{},
			{
				onSuccess() {
					createdTitle.value = lesson.title.trim()
					return linkLesson(name)
				},
				onError(err: unknown) {
					toast.error(resourceErrorMessage(err))
				},
			}
		)
	}
	return submitResource(
		insertLesson,
		{},
		{
			// Awaited by submitResource, so `submit()` does not resolve before the
			// reference exists and the lesson is only half-created.
			onSuccess(data) {
				createdLesson.value = (data as { name: string }).name
				createdTitle.value = lesson.title.trim()
				return linkLesson(createdLesson.value)
			},
			onError(err: unknown) {
				toast.error(resourceErrorMessage(err))
			},
		}
	)
}

function linkLesson(lessonName: string) {
	return submitResource(
		insertReference,
		{ lesson: lessonName },
		{
			onSuccess() {
				capture('lesson_created')
				toast.success(__('Lesson created'))
				emit('created', { name: lessonName, number: `${props.lessonIdx}` })
				show.value = false
			},
			onError(err: unknown) {
				toast.error(resourceErrorMessage(err))
			},
		}
	)
}
</script>
