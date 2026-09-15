<template>
	<FormShell
		:title="isEdit ? __('Edit Chapter') : __('Add Chapter')"
		size="lg"
		@close="close"
	>
		<template #default>
			<div v-if="!canManageChapters" class="p-4 text-p-base text-ink-gray-6">
				{{ refusal }}
			</div>
			<div v-else data-testid="chapter-fields" class="space-y-4 text-base">
				<FormControl
					label="Title"
					v-model="chapter.title"
					:required="true"
					autocomplete="off"
				/>
				<BooleanSwitch
					size="sm"
					:label="__('SCORM Package')"
					:description="
						__(
							'Enable this only if you want to upload a SCORM package as a chapter.'
						)
					"
					v-model="chapter.is_scorm_package"
				/>
				<div v-if="chapter.is_scorm_package">
					<FileUploader
						v-if="!chapter.scorm_package"
						:fileTypes="['.zip']"
						:uploadArgs="{ private: true }"
						:validateFile="validateFile"
						@success="(file) => (chapter.scorm_package = file)"
					>
						<template v-slot="{ file, progress, uploading, openFileSelector }">
							<div class="mb-4">
								<Button @click="openFileSelector" :loading="uploading">
									{{ uploadLabel(uploading, progress) }}
								</Button>
							</div>
						</template>
					</FileUploader>
					<div v-else class="">
						<div class="flex items-center">
							<div class="border rounded-md p-2 me-2 shrink-0">
								<span class="lucide-file-text h-5 w-5 text-ink-gray-7" />
							</div>
							<div class="flex min-w-0 flex-1 flex-col">
								<span
									class="truncate text-ink-gray-9"
									:title="chapter.scorm_package.file_name"
								>
									{{ chapter.scorm_package.file_name }}
								</span>
								<span
									v-if="chapter.scorm_package.file_size"
									class="text-sm text-ink-gray-4 mt-1"
								>
									{{ getFileSize(chapter.scorm_package.file_size) }}
								</span>
							</div>
							<button
								type="button"
								:aria-label="__('Remove file')"
								@click="() => (chapter.scorm_package = null)"
								class="lucide-x bg-surface-gray-3 rounded-md cursor-pointer w-5 h-5 p-1 ms-4 shrink-0"
							/>
						</div>
					</div>
				</div>
			</div>
		</template>
		<template #actions>
			<div v-if="canManageChapters" class="flex items-center justify-end">
				<HeaderButton
					data-testid="chapter-save"
					:label="__('Save')"
					variant="solid"
					:loading="chapterResource.loading"
					:disabled="isEdit && !chapterDetail"
					@click="saveChapter()"
				/>
			</div>
		</template>
	</FormShell>
</template>
<script setup lang="ts">
import {
	Button,
	createResource,
	FileUploader,
	FormControl,
	getCachedResource,
	toast,
} from 'frappe-ui'
import BooleanSwitch from '@/components/Controls/BooleanSwitch.vue'
import { computed, inject, onMounted, reactive, watch } from 'vue'
import { useRoute } from 'vue-router'
import { getFileSize } from '@/utils/'
import { resourceErrorMessage, submitResource } from '@/utils/resource'
import { useOnboarding, useTelemetry } from 'frappe-ui/frappe'
import FormShell from '@/components/FormShell.vue'
import HeaderButton from '@/components/HeaderButton.vue'
import { useFormRoute } from '@/composables/useFormRoute'
import type { OutlineChapter, Resource, SessionUser } from '@/types'

// Both strings were translated before the modal became this page and lost their
// __() wrappers. In the script rather than the template because vue-tsc does not
// resolve the global __ against this file's setup bindings.
const uploadLabel = (uploading: boolean, progress: number): string =>
	uploading ? __('Uploading {0}%').format(progress) : __('Upload a ZIP file')

// build_outline expands scorm_package into {name, file_name, file_size,
// file_url} only while the File row still exists; once it is deleted the raw
// Course Chapter.scorm_package DOCNAME comes through instead (utils.py
// build_outline). Both shapes have to survive as far as makeParams, which must
// always post an object — upsert_chapter does frappe._dict(scorm_package or {})
// and a string there is a ValueError, i.e. a 500 on renaming the chapter.
type ScormPackage = {
	name?: string
	file_name?: string
	file_size?: number
} | null

interface ChapterFields {
	title: string
	is_scorm_package: 0 | 1
	scorm_package: ScormPackage
}

const props = defineProps<{
	courseName: string
	chapterName: string
}>()

const route = useRoute()
const user = inject<SessionUser>('$user')!
const { capture } = useTelemetry()
const { updateOnboardingStep } = useOnboarding('learning')

// House style for a route that serves both create and edit
// (`/job-opening/:jobName/edit`, JobForm.vue:147-149).
const isEdit = computed(() => props.chapterName !== 'new')

// C2 — the course page keeps its active tab in route.hash as a tab KEY
// (`#editor`, `#settings`) and pushes on tab change
// (TabbedDetailPage.vue:142-162), and CourseEditor keeps the open lesson in
// route.query (CourseEditor.vue:129-136). Both have to travel back with us:
// closing to a hash-less CourseDetail would flip the parent to tab 0 behind the
// form, and a query-less one would lose the lesson being edited.
const parent = {
	name: 'CourseDetail',
	params: { courseName: props.courseName },
	hash: route.hash,
	query: { ...route.query },
}
const { close, saveAndReplace } = useFormRoute(parent)

// UX gate only, lifted off CourseOutline.vue:79, which gated the modal's very
// existence on a signed-in user. A URL does not go through that v-if. The
// authorization boundary is server-side: upsert_chapter calls
// can_modify_course() and throws PermissionError (lms/lms/api.py:1369-1370).
const canManageChapters = computed(() => Boolean(user.data))

// Built here rather than inline in the template because vue-tsc currently
// cannot see the `__` augmentation on ComponentCustomProperties, so every
// template call site is an error; the global `__` declaration works fine from
// script. Same string either way.
const refusal = __('You are not permitted to manage chapters.')

const chapter = reactive<ChapterFields>({
	title: '',
	is_scorm_package: 0,
	scorm_package: null,
})

// C4 — edit mode used to be seeded from an in-memory row the parent passed in,
// which is empty on a cold deep link. There is no single-chapter endpoint in
// the app, so the form fetches the course outline itself.
//
// Deliberately NOT `cache: ['course_outline', courseName]`, the key
// CourseOutline.vue:160-167 and CourseEditor.vue:231-238 use: createResource
// keeps the FIRST constructor's options and hands that instance to every later
// caller (resources.js:12-20). On a deep link to this form the outline tab is
// not mounted yet, so this file would win the shared key with its own
// `auto: false` and `progress: false` — and CourseOutline, whose only other
// fetch trigger is a non-immediate watch, would then render an empty chapter
// list on a course that has chapters. Same rule as MemberForm.vue:158-162.
//
// The outline row, not the Course Chapter doc, is the right source: the outline
// expands `scorm_package` into its File record (utils.py:1244-1245), and both
// the SCORM summary here and the re-save need `file_name`/`file_size`/`name`
// off it. A plain document fetch would return only the File's docname.
const outline = createResource({
	url: 'lms.lms.utils.get_course_outline',
	cache: ['chapter_form_outline', props.courseName],
	makeParams() {
		return { course: props.courseName, progress: false }
	},
	auto: false,
	// Double cast: createResource is typed Resource<any>, which TS will not
	// narrow directly.
}) as unknown as Resource<OutlineChapter[] | null>

// C3 — the old watch had no `immediate`, so a directly-mounted route rendered
// an empty form. Nothing else fills this key, so edit mode always fetches.
onMounted(() => {
	if (isEdit.value) outline.fetch()
})

const chapterDetail = computed<OutlineChapter | null>(() => {
	if (!isEdit.value) return null
	return (
		(outline.data ?? []).find((row) => row.name === props.chapterName) ?? null
	)
})

// A bare docname is all that survives a deleted File; keep it as the name so
// the save still identifies the package, and show it in place of a filename
// rather than rendering "undefined".
const toScormPackage = (value: unknown): ScormPackage => {
	if (!value) return null
	if (typeof value === 'string') return { name: value, file_name: value }
	return value as ScormPackage
}

watch(
	chapterDetail,
	(found) => {
		chapter.title = found?.title ?? ''
		chapter.is_scorm_package = (found?.is_scorm_package ?? 0) as 0 | 1
		chapter.scorm_package = toScormPackage(found?.scorm_package)
	},
	{ immediate: true }
)

const chapterResource = createResource({
	url: 'lms.lms.api.upsert_chapter',
	makeParams() {
		return {
			title: chapter.title,
			course: props.courseName,
			is_scorm_package: chapter.is_scorm_package,
			scorm_package: chapter.scorm_package,
			name: isEdit.value ? props.chapterName : undefined,
		}
	},
})

const validateChapter = (): string | undefined => {
	if (!chapter.title) {
		return __('Title is required')
	}
	if (chapter.is_scorm_package && !chapter.scorm_package) {
		return __('Please upload a SCORM package')
	}
	return undefined
}

const saveChapter = () => {
	if (!canManageChapters.value) return
	// Edit mode before the outline lands would post a blank title over a real
	// chapter; the button is disabled for the same reason.
	if (isEdit.value && !chapterDetail.value) return
	// submitResource, not a bare submit(): createResource's handleError calls
	// onError and then RETHROWS, so a bare statement leaves a rejected promise
	// nobody handles on every validation failure or 500. It also keeps a throw
	// from onSuccess — updateOnboardingStep throws when onboarding is not
	// registered — out of frappe-ui's error path, so a saved chapter is never
	// reported as a failed one. Validation runs in the helper because
	// createResource's `validate` wraps the message in new Error(), which this
	// onError could only ever render as a bare "Error".
	return submitResource(
		chapterResource,
		{},
		{
			validate: validateChapter,
			onSuccess() {
				if (!isEdit.value) {
					if (user.data?.is_system_manager)
						updateOnboardingStep('create_first_chapter')
					capture('chapter_created')
				}
				// Stands in for the modal's `created`/`updated` emits: a route
				// component has no parent listening, so refresh the outline the
				// page behind us holds. Reloading our own instance would do
				// nothing for it — the keys are separate, and saving navigates
				// away from this one. Null on a deep link, where that page was
				// never mounted; correct, since it fetches on mount.
				getCachedResource(['course_outline', props.courseName])?.reload()
				toast.success(
					isEdit.value
						? __('Chapter updated successfully')
						: __('Chapter added successfully')
				)
				// replace, not push: the form entry is consumed, so Back reaches
				// the course rather than a stale form.
				saveAndReplace(parent)
			},
			onError(err: unknown) {
				toast.error(resourceErrorMessage(err))
			},
		}
	)
}

const validateFile = (file: File): string | undefined => {
	const extension = file.name.split('.').pop()?.toLowerCase()
	if (extension !== 'zip') {
		return __('Only zip files are allowed')
	}
	return undefined
}
</script>
