<template>
	<Dialog
		v-model:open="show"
		:title="chapterDetail ? __('Edit Chapter') : __('Add Chapter')"
		size="lg"
		:actions="[
			{
				label: chapterDetail ? __('Edit') : __('Create'),
				variant: 'solid',
				onClick: ({ close }) =>
					chapterDetail ? editChapter(close) : addChapter(close),
			},
		]"
	>
		<template #default>
			<div class="space-y-4 text-base">
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
								<Button
									class="text-p-base-medium"
									:loading="uploading"
									@click="openFileSelector"
								>
									{{
										uploading
											? __('Uploading {0}%').format(progress)
											: __('Upload a ZIP file')
									}}
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
	</Dialog>
</template>
<script setup lang="ts">
import {
	Button,
	createResource,
	Dialog,
	FileUploader,
	FormControl,
	toast,
} from 'frappe-ui'
import BooleanSwitch from '@/components/Controls/BooleanSwitch.vue'
import { reactive, watch, inject } from 'vue'
import { getFileSize } from '@/utils/'
import { resourceErrorMessage, submitResource } from '@/utils/resource'
import { useOnboarding, useTelemetry } from 'frappe-ui/frappe'
import type { ChapterDetailInput, SessionUser } from '@/types'

// build_outline only expands scorm_package into {name, file_name, file_size,
// file_url} while the File row still exists; once it is deleted the raw
// Course Chapter.scorm_package DOCNAME comes through instead. Both shapes have
// to survive as far as makeParams, which must always post an object —
// upsert_chapter does frappe._dict(scorm_package or {}) and a string there is a
// ValueError, i.e. a 500 on renaming the chapter.
type ScormPackage = {
	name?: string
	file_name?: string
	file_size?: number
} | null

interface ChapterForm {
	title: string
	is_scorm_package: 0 | 1
	scorm_package: ScormPackage
}

const show = defineModel<boolean>()
const emit = defineEmits<{ created: []; updated: [] }>()
const user = inject<SessionUser>('$user')!
const { capture } = useTelemetry()
const { updateOnboardingStep } = useOnboarding('learning')

const props = defineProps<{
	course: string
	chapterDetail?: ChapterDetailInput | null
}>()

const chapter = reactive<ChapterForm>({
	title: '',
	is_scorm_package: 0,
	scorm_package: null,
})

const chapterResource = createResource({
	url: 'lms.lms.api.upsert_chapter',
	makeParams() {
		return {
			title: chapter.title,
			course: props.course,
			is_scorm_package: chapter.is_scorm_package,
			scorm_package: chapter.scorm_package,
			name: props.chapterDetail?.name,
		}
	},
})

const addChapter = (close: () => void) =>
	submitResource(
		chapterResource,
		{},
		{
			validate: validateChapter,
			onSuccess: () => {
				if (user.data?.is_system_manager)
					updateOnboardingStep('create_first_chapter')

				capture('chapter_created')
				cleanChapter()
				emit('created')
				toast.success(__('Chapter added successfully'))
				close()
			},
			onError(err: unknown) {
				toast.error(resourceErrorMessage(err))
			},
		}
	)

const validateChapter = (): string | undefined => {
	if (!chapter.title) {
		return __('Title is required')
	}
	if (chapter.is_scorm_package && !chapter.scorm_package) {
		return __('Please upload a SCORM package')
	}
	return undefined
}

const cleanChapter = () => {
	chapter.title = ''
	chapter.is_scorm_package = 0
	chapter.scorm_package = null
}

const editChapter = (close: () => void) =>
	submitResource(
		chapterResource,
		{},
		{
			validate: validateChapter,
			onSuccess() {
				emit('updated')
				toast.success(__('Chapter updated successfully'))
				close()
			},
			onError(err: unknown) {
				toast.error(resourceErrorMessage(err))
			},
		}
	)

// A bare docname is all that survives a deleted File; keep it as the name so
// the submit still identifies the package, and show it in place of a filename
// rather than rendering "undefined".
const toScormPackage = (value: unknown): ScormPackage => {
	if (!value) return null
	if (typeof value === 'string') return { name: value, file_name: value }
	return value as ScormPackage
}

watch(
	() => props.chapterDetail,
	(newChapter) => {
		chapter.title = newChapter?.title ?? ''
		chapter.is_scorm_package = (newChapter?.is_scorm_package ?? 0) as 0 | 1
		chapter.scorm_package = toScormPackage(newChapter?.scorm_package)
	}
)

const validateFile = (file: File): string | undefined => {
	const extension = file.name.split('.').pop()?.toLowerCase()
	if (extension !== 'zip') {
		return __('Only zip files are allowed')
	}
	return undefined
}
</script>
