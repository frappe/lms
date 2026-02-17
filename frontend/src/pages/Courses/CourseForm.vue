<template>
	<div class="pl-5">
		<div class="grid grid-cols-1 md:grid-cols-[70%,30%] overflow-hidden">
			<div v-if="courseResource.doc" class="h-[88vh] overflow-y-auto">
				<div class="my-5">
					<div class="pr-5 md:pr-10 pb-5 mb-5 space-y-5 border-b">
						<div class="text-lg font-semibold mb-4 text-ink-gray-9">
							{{ __('Details') }}
						</div>
						<div class="grid grid-cols-1 md:grid-cols-2 gap-5">
							<FormControl
								v-model="courseResource.doc.title"
								:label="__('Title')"
								:required="true"
								@input="makeFormDirty()"
							/>
							<Link
								doctype="LMS Category"
								v-model="courseResource.doc.category"
								:label="__('Category')"
								:onCreate="(value, close) => openSettings('Categories', close)"
								@update:modelValue="makeFormDirty()"
							/>
						</div>
						<div class="grid grid-cols-1 md:grid-cols-2 gap-5">
							<MultiSelect
								v-model="instructors"
								doctype="User"
								:label="__('Instructors')"
								:filters="{ ignore_user_type: 1 }"
								:onCreate="(close) => openSettings('Members', close)"
								:required="true"
								@update:modelValue="makeFormDirty()"
							/>
							<div>
								<div class="text-xs text-ink-gray-5">
									{{ __('Tags') }}
								</div>
								<FormControl
									v-model="newTag"
									:placeholder="__('Add a keyword and then press enter')"
									:class="['w-full', 'flex-1', 'my-1']"
									@keyup.enter="updateTags()"
									id="tags"
								/>
								<div>
									<div class="flex items-center flex-wrap gap-2">
										<div
											v-if="courseResource.doc.tags"
											v-for="tag in courseResource.doc.tags?.split(', ')"
											class="flex items-center bg-surface-gray-2 text-ink-gray-7 p-2 rounded-md"
										>
											{{ tag }}
											<X
												class="stroke-1.5 w-3 h-3 ml-2 cursor-pointer"
												@click="removeTag(tag)"
											/>
										</div>
									</div>
								</div>
							</div>
						</div>
						<div class="grid grid-cols-1 md:grid-cols-2 gap-5">
							<Uploader
								v-model="courseResource.doc.image"
								:label="__('Course Image')"
								:required="false"
								@update:modelValue="makeFormDirty()"
							/>

							<ColorSwatches
								v-model="courseResource.doc.card_gradient"
								:label="__('Color')"
								:description="__('Choose a color for the course card')"
								class="w-full"
								@update:modelValue="makeFormDirty()"
							/>
						</div>
					</div>

					<div class="pr-5 md:pr-10 pb-5 mb-5 space-y-5 border-b">
						<div class="text-lg font-semibold text-ink-gray-9">
							{{ __('Settings') }}
						</div>
						<div class="grid grid-cols-1 md:grid-cols-2 gap-5">
							<div
								v-if="user.data?.is_moderator"
								class="flex flex-col space-y-5"
							>
								<FormControl
									type="checkbox"
									v-model="courseResource.doc.published"
									:label="__('Published')"
									@change="makeFormDirty()"
								/>
								<FormControl
									v-model="courseResource.doc.published_on"
									:label="__('Published On')"
									type="date"
									@change="makeFormDirty()"
								/>
							</div>
							<div class="flex flex-col space-y-5">
								<FormControl
									type="checkbox"
									v-model="courseResource.doc.upcoming"
									:label="__('Upcoming')"
									@change="makeFormDirty()"
								/>
								<FormControl
									type="checkbox"
									v-model="courseResource.doc.featured"
									:label="__('Featured')"
									@change="makeFormDirty()"
								/>
								<FormControl
									type="checkbox"
									v-model="courseResource.doc.disable_self_learning"
									:label="__('Disable Self Enrollment')"
									@change="makeFormDirty()"
								/>
							</div>
						</div>
					</div>

					<div class="pr-5 md:pr-10 pb-5 mb-5 space-y-5 border-b">
						<div class="text-lg font-semibold text-ink-gray-9">
							{{ __('About the Course') }}
						</div>
						<FormControl
							v-model="courseResource.doc.short_introduction"
							type="textarea"
							:rows="5"
							:label="__('Short Introduction')"
							:placeholder="
								__(
									'A one line introduction to the course that appears on the course card'
								)
							"
							:required="true"
							@change="makeFormDirty()"
						/>
						<div class="">
							<div class="mb-1.5 text-sm text-ink-gray-5">
								{{ __('Course Description') }}
								<span class="text-ink-red-3">*</span>
							</div>
							<TextEditor
								:content="courseResource.doc.description"
								@change="
									(val) => {
										courseResource.doc.description = val
										makeFormDirty()
									}
								"
								:editable="true"
								:fixedMenu="true"
								editorClass="prose-sm max-w-none border-b border-x border-outline-gray-modals bg-surface-gray-2 rounded-b-md py-1 px-2 min-h-[7rem]"
							/>
						</div>

						<FormControl
							v-model="courseResource.doc.video_link"
							:label="__('Preview Video')"
							:placeholder="
								__(
									'Paste the youtube link of a short video introducing the course'
								)
							"
							@input="makeFormDirty()"
						/>

						<MultiSelect
							v-model="related_courses"
							doctype="LMS Course"
							:label="__('Related Courses')"
							:filters="{ name: ['!=', courseResource.doc?.name] }"
							:onCreate="
								(close) => {
									router.push({
										name: 'Courses',
										query: { newCourse: '1' },
									})
								}
							"
							@update:modelValue="makeFormDirty()"
						/>
					</div>

					<div class="pr-5 md:pr-10 pb-5 space-y-5 border-b">
						<div class="text-lg font-semibold mt-5 text-ink-gray-9">
							{{ __('Pricing and Certification') }}
						</div>
						<div class="grid grid-cols-1 md:grid-cols-3 gap-5">
							<FormControl
								type="checkbox"
								v-model="courseResource.doc.paid_course"
								:label="__('Paid Course')"
								@change="makeFormDirty()"
							/>
							<FormControl
								type="checkbox"
								v-model="courseResource.doc.enable_certification"
								:label="__('Completion Certificate')"
								@change="makeFormDirty()"
							/>
							<FormControl
								type="checkbox"
								v-model="courseResource.doc.paid_certificate"
								:label="__('Paid Certificate')"
								@change="makeFormDirty()"
							/>
						</div>
						<div class="grid grid-cols-1 md:grid-cols-2 gap-5">
							<div class="space-y-5">
								<FormControl
									v-if="
										courseResource.doc.paid_course ||
										courseResource.doc.paid_certificate
									"
									v-model="courseResource.doc.course_price"
									:label="__('Amount')"
									:required="
										courseResource.doc.paid_course ||
										courseResource.doc.paid_certificate
									"
									@input="makeFormDirty()"
								/>
								<Link
									v-if="courseResource.doc.paid_certificate"
									doctype="Course Evaluator"
									v-model="courseResource.doc.evaluator"
									:label="__('Evaluator')"
									:required="courseResource.doc.paid_certificate"
									:onCreate="
										(value, close) => openSettings('Evaluators', close)
									"
									@update:modelValue="makeFormDirty()"
								/>
							</div>
							<div class="space-y-5">
								<Link
									v-if="
										courseResource.doc.paid_course ||
										courseResource.doc.paid_certificate
									"
									doctype="Currency"
									v-model="courseResource.doc.currency"
									:filters="{ enabled: 1 }"
									:label="__('Currency')"
									:required="
										courseResource.doc.paid_course ||
										courseResource.doc.paid_certificate
									"
									@update:modelValue="makeFormDirty()"
								/>
								<FormControl
									v-if="courseResource.doc.paid_certificate"
									v-model="courseResource.doc.timezone"
									:label="__('Timezone')"
									:required="courseResource.doc.paid_certificate"
									:placeholder="__('e.g. IST, UTC, GMT...')"
									@input="makeFormDirty()"
								/>
							</div>
						</div>
					</div>

					<div class="pr-5 md:pr-10 pb-5 space-y-5">
						<div class="text-lg font-semibold mt-5 text-ink-gray-9">
							{{ __('Meta Tags') }}
						</div>
						<div class="space-y-5">
							<FormControl
								v-model="meta.description"
								:label="__('Meta Description')"
								type="textarea"
								:rows="7"
								@input="makeFormDirty()"
							/>
							<FormControl
								v-model="meta.keywords"
								:label="__('Meta Keywords')"
								type="textarea"
								:rows="7"
								:placeholder="__('Comma separated keywords for SEO')"
								@input="makeFormDirty()"
							/>
						</div>
					</div>
				</div>
			</div>
			<div class="border-l h-[88vh] overflow-y-auto">
				<CourseOutline
					v-if="courseResource.doc"
					:courseName="courseResource.doc.name"
					:title="__('Chapters')"
					:allowEdit="true"
				/>
			</div>
		</div>
	</div>
</template>
<script setup>
import {
	TextEditor,
	Button,
	createResource,
	createDocumentResource,
	FormControl,
	usePageMeta,
	toast,
} from 'frappe-ui'
import {
	inject,
	onMounted,
	onBeforeUnmount,
	ref,
	reactive,
	watch,
	getCurrentInstance,
} from 'vue'
import {
	escapeHTML,
	getMetaInfo,
	openSettings,
	sanitizeHTML,
	updateMetaInfo,
} from '@/utils'
import { Trash2, X } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { sessionStore } from '../../stores/session'
import Link from '@/components/Controls/Link.vue'
import CourseOutline from '@/components/CourseOutline.vue'
import MultiSelect from '@/components/Controls/MultiSelect.vue'
import ColorSwatches from '@/components/Controls/ColorSwatches.vue'
import Uploader from '@/components/Controls/Uploader.vue'

const user = inject('$user')
const newTag = ref('')
const { brand } = sessionStore()
const router = useRouter()
const instructors = ref([])
const related_courses = ref([])
const app = getCurrentInstance()
const { $dialog } = app.appContext.config.globalProperties
const isDirty = ref(false)

const props = defineProps({
	course: {
		type: Object,
	},
})

const meta = reactive({
	description: '',
	keywords: '',
})

onMounted(() => {
	if (!user.data?.is_moderator && !user.data?.is_instructor) {
		router.push({ name: 'Courses' })
	}
	window.addEventListener('keydown', keyboardShortcut)
})

const courseResource = createDocumentResource({
	doctype: 'LMS Course',
	name: props.course.data?.name,
	auto: true,
})

watch(
	() => courseResource.doc,
	() => {
		check_permission()
		getMetaInfo('courses', courseResource.doc?.name, meta)
		updateCourseData()
	}
)

const updateCourseData = () => {
	Object.keys(courseResource.doc).forEach((key) => {
		if (key == 'instructors') {
			instructors.value = []
			courseResource.doc.instructors.forEach((instructor) => {
				instructors.value.push(instructor.instructor)
			})
		} else if (key == 'related_courses') {
			related_courses.value = []
			courseResource.doc.related_courses.forEach((course) => {
				related_courses.value.push(course.course)
			})
		}
	})
	let checkboxes = [
		'published',
		'upcoming',
		'disable_self_learning',
		'paid_course',
		'featured',
		'enable_certification',
		'paid_certificate',
	]
	for (let idx in checkboxes) {
		let key = checkboxes[idx]
		courseResource.doc[key] = courseResource.doc[key] ? true : false
	}
}

const submitCourse = () => {
	validateFields()
	updateCourse()
}

const validateFields = () => {
	courseResource.doc.description = sanitizeHTML(courseResource.doc.description)

	Object.keys(courseResource.doc).forEach((key) => {
		if (key != 'description' && typeof courseResource.doc[key] === 'string') {
			courseResource.doc[key] = escapeHTML(courseResource.doc[key])
		}
	})
}

const updateCourse = () => {
	courseResource.setValue.submit(
		{
			...courseResource.doc,
			instructors: instructors.value.map((instructor) => ({
				instructor: instructor,
			})),
			related_courses: related_courses.value.map((course) => ({
				course: course,
			})),
		},
		{
			onSuccess() {
				updateMetaInfo('courses', courseResource.doc?.name, meta)
				toast.success(__('Course updated successfully'))
				isDirty.value = false
				courseResource.reload()
			},
			onError(err) {
				toast.error(err.messages?.[0] || err)
				console.error(err)
			},
		}
	)
}

const keyboardShortcut = (e) => {
	if (
		e.key === 's' &&
		(e.ctrlKey || e.metaKey) &&
		!e.target.classList.contains('ProseMirror')
	) {
		submitCourse()
		e.preventDefault()
	}
}

onBeforeUnmount(() => {
	window.removeEventListener('keydown', keyboardShortcut)
})

const deleteCourse = createResource({
	url: 'lms.lms.api.delete_course',
	makeParams(values) {
		return {
			course: courseResource.doc?.name,
		}
	},
	onSuccess() {
		toast.success(__('Course deleted successfully'))
		router.push({ name: 'Courses' })
	},
})

const trashCourse = () => {
	$dialog({
		title: __('Delete Course'),
		message: __(
			'Deleting the course will also delete all its chapters and lessons. Are you sure you want to delete this course?'
		),
		actions: [
			{
				label: __('Delete'),
				theme: 'red',
				variant: 'solid',
				onClick(close) {
					deleteCourse.submit()
					close()
				},
			},
		],
	})
}

const updateTags = () => {
	if (newTag.value) {
		courseResource.doc.tags = courseResource.doc.tags
			? `${courseResource.doc.tags}, ${newTag.value}`
			: newTag.value
		newTag.value = ''
		makeFormDirty()
	}
}

const removeTag = (tag) => {
	courseResource.doc.tags = courseResource.doc.tags
		?.split(', ')
		.filter((t) => t !== tag)
		.join(', ')
	newTag.value = ''
	makeFormDirty()
}

const check_permission = () => {
	let user_is_instructor = false
	if (user.data?.is_moderator) return

	instructors.value.forEach((instructor) => {
		if (!user_is_instructor && instructor == user.data?.name) {
			user_is_instructor = true
		}
	})

	if (!user_is_instructor) {
		router.push({ name: 'Courses' })
	}
}

const makeFormDirty = () => {
	isDirty.value = true
}

usePageMeta(() => {
	return {
		title: courseResource.doc?.title,
		icon: brand.favicon,
	}
})

defineExpose({
	submitCourse,
	trashCourse,
	isDirty,
})
</script>
