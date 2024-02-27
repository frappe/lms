<template>
	<div class="h-screen text-base">
		<div class="grid grid-cols-[70%,30%] h-full">
			<div>
				<header
					class="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-3 py-2.5 sm:px-5"
				>
					<Breadcrumbs
						class="h-7"
						:items="[
							{
								label: __('Courses'),
								route: { name: 'Courses' },
							},
							{
								label: __('New Course'),
								route: { name: 'CreateCourse', params: { courseName: 'new' } },
							},
						]"
					/>
					<Button variant="solid" @click="submitCourse()">
						<span>
							{{ __('Save') }}
						</span>
					</Button>
				</header>
				<div class="container mt-5">
					<Input v-model="course.title" :label="__('Title')" class="mb-2" />
					<Input
						v-model="course.short_introduction"
						:label="__('Short Introduction')"
						class="mb-2"
					/>
					<div class="mb-4">
						<div class="mb-1.5 text-sm text-gray-700">
							{{ __('Course Description') }}
						</div>
						<TextEditor
							:content="course.description"
							@change="(val) => (topic.reply = val)"
							:editable="true"
							:fixedMenu="true"
							editorClass="prose-sm max-w-none border-b border-x bg-gray-100 rounded-b-md py-1 px-2 min-h-[7rem]"
						/>
					</div>
					<Input
						v-model="course.video_link"
						:label="__('Preview Video')"
						class="mb-2"
					/>
					<Input v-model="course.tags" :label="__('Tags')" class="mb-2" />
					<div class="flex items-center mb-4">
						<Checkbox v-model="course.published" :label="__('Published')" />
						<Checkbox
							v-model="course.upcoming"
							:label="__('Upcoming')"
							class="ml-20"
						/>
					</div>
					<Checkbox
						v-model="course.paid_course"
						:label="__('Paid Course')"
						class="mb-2"
					/>
					<Input
						v-model="course.course_price"
						:label="__('Course Price')"
						class="mb-2"
					/>
				</div>
			</div>
			<div class="bg-gray-50"></div>
		</div>
	</div>
</template>
<script setup>
import {
	Breadcrumbs,
	Input,
	TextEditor,
	Checkbox,
	Button,
	createDocumentResource,
	createResource,
} from 'frappe-ui'
import { reactive, inject, onMounted } from 'vue'

const user = inject('$user')

onMounted(() => {
	if (!user.data?.is_moderator || !user.data?.is_instructor) {
		window.location.href = '/login'
	}
})

const course = reactive({
	title: '',
	short_introduction: '',
	description: '',
	video_link: '',
	tags: '',
	published: false,
	upcoming: false,
	image: null,
	paid_course: false,
	course_price: 0,
	currency: '',
})

const courseResource = createResource({
	url: 'frappe.client.insert',
	makeParams() {
		return {
			doc: {
				doctype: 'LMS Course',
				...course,
			},
		}
	},
})
console.log(courseResource)

const submitCourse = () => {
	courseResource.submit(
		{},
		{
			validate() {},
		}
	)
}
</script>
