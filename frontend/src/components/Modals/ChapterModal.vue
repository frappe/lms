<template>
	<Dialog
		v-model="show"
		:options="{
			title: __('Add Chapter'),
			size: 'lg',
			actions: [
				{
					label: chapterDetail ? __('Edit Chapter') : __('Add Chapter'),
					variant: 'solid',
					onClick: (close) =>
						chapterDetail ? editChapter(close) : addChapter(close),
				},
			],
		}"
	>
		<template #body-content>
			<FormControl label="Title" v-model="chapter.title" class="mb-4" />
		</template>
	</Dialog>
</template>
<script setup>
import { Dialog, FormControl, createResource } from 'frappe-ui'
import { defineModel, reactive, watch, inject } from 'vue'
import { createToast, formatTime } from '@/utils/'

const show = defineModel()
const outline = defineModel('outline')

const props = defineProps({
	course: {
		type: String,
		required: true,
	},
	chapterDetail: {
		type: Object,
	},
})
const chapter = reactive({
	title: '',
})

const chapterResource = createResource({
	url: 'frappe.client.insert',
	makeParams(values) {
		return {
			doc: {
				doctype: 'Course Chapter',
				title: chapter.title,
				description: chapter.description,
				course: props.course,
			},
		}
	},
})

const chapterEditResource = createResource({
	url: 'frappe.client.set_value',
	makeParams(values) {
		return {
			doctype: 'Course Chapter',
			name: props.chapterDetail?.name,
			fieldname: 'title',
			value: chapter.title,
		}
	},
})

const chapterReference = createResource({
	url: 'frappe.client.insert',
	makeParams(values) {
		return {
			doc: {
				doctype: 'Chapter Reference',
				chapter: values.name,
				parent: props.course,
				parenttype: 'LMS Course',
				parentfield: 'chapters',
			},
		}
	},
})

const addChapter = (close) => {
	chapterResource.submit(
		{},
		{
			validate() {
				if (!chapter.title) {
					return 'Title is required'
				}
			},
			onSuccess: (data) => {
				chapterReference.submit(
					{ name: data.name },
					{
						onSuccess(data) {
							outline.value.reload()
							createToast({
								text: 'Chapter added successfully',
								icon: 'check',
								iconClasses: 'bg-green-600 text-white rounded-md p-px',
							})
						},
						onError(err) {
							showError(err)
						},
					}
				)
				close()
			},
			onError(err) {
				showError(err)
			},
		}
	)
}

const editChapter = (close) => {
	chapterEditResource.submit(
		{},
		{
			validate() {
				if (!chapter.title) {
					return 'Title is required'
				}
			},
			onSuccess() {
				outline.value.reload()
				createToast({
					text: 'Chapter updated successfully',
					icon: 'check',
					iconClasses: 'bg-green-600 text-white rounded-md p-px',
				})
				close()
			},
			onError(err) {
				showError(err)
			},
		}
	)
}

const showError = (err) => {
	createToast({
		title: 'Error',
		text: err.messages?.[0] || err,
		icon: 'x',
		iconClasses: 'bg-red-600 text-white rounded-md p-px',
		position: 'top-center',
		timeout: 10,
	})
}

watch(
	() => props.chapterDetail,
	(newChapter) => {
		chapter.title = newChapter?.title
	}
)
</script>
