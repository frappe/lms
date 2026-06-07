<template>
	<Dialog
		v-model="show"
		:options="{
			title: chapterDetail ? __('Edit Chapter') : __('Add Chapter'),
			size: 'lg',
			actions: [
				{
					label: chapterDetail ? __('Edit') : __('Create'),
					variant: 'solid',
					onClick: (close) =>
						chapterDetail ? editChapter(close) : addChapter(close),
				},
			],
		}"
	>
		<template #body-content>
			<div class="space-y-4 text-base">
				<FormControl
					label="Title"
					v-model="chapter.title"
					:required="true"
					autocomplete="off"
				/>
				<Switch
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
						:validateFile="validateFile"
						@success="(file) => (chapter.scorm_package = file)"
					>
						<template v-slot="{ file, progress, uploading, openFileSelector }">
							<div class="mb-4">
								<Button @click="openFileSelector" :loading="uploading">
									{{
										uploading ? `Uploading ${progress}%` : 'Upload an ZIP file'
									}}
								</Button>
							</div>
						</template>
					</FileUploader>
					<div v-else class="">
						<div class="flex items-center">
							<div class="border rounded-md p-2 me-2">
								<FileText class="h-5 w-5 stroke-1.5 text-ink-gray-7" />
							</div>
							<div class="flex flex-col">
								<span class="text-ink-gray-9">
									{{ chapter.scorm_package.file_name }}
								</span>
								<span class="text-sm text-ink-gray-4 mt-1">
									{{ getFileSize(chapter.scorm_package.file_size) }}
								</span>
							</div>
							<X
								@click="() => (chapter.scorm_package = null)"
								class="bg-surface-gray-3 rounded-md cursor-pointer stroke-1.5 w-5 h-5 p-1 ms-4"
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
import Switch from '@/components/Controls/Switch.vue'
import { reactive, watch, inject } from 'vue'
import { getFileSize } from '@/utils/'
import { FileText, X } from 'lucide-vue-next'
import { useOnboarding, useTelemetry } from 'frappe-ui/frappe'
import type { ChapterDetailInput, Resource, SessionUser } from '@/types/api'

type ScormPackage = { file_name: string; file_size: number } | null

interface ChapterForm {
	title: string
	is_scorm_package: 0 | 1
	scorm_package: ScormPackage
}

const show = defineModel<boolean>()
const outline = defineModel<Resource<unknown> | undefined>('outline')
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

const errorMessage = (err: { messages?: string[] } | string): string =>
	typeof err === 'string' ? err : err.messages?.[0] ?? 'Error'

const addChapter = async (close: () => void) => {
	chapterResource.submit(
		{},
		{
			validate() {
				return validateChapter()
			},
			onSuccess: () => {
				if (user.data?.is_system_manager)
					updateOnboardingStep('create_first_chapter')

				capture('chapter_created')
				cleanChapter()
				outline.value?.reload()
				toast.success(__('Chapter added successfully'))
				close()
			},
			onError(err: { messages?: string[] } | string) {
				toast.error(errorMessage(err))
			},
		}
	)
}

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

const editChapter = (close: () => void) => {
	chapterResource.submit(
		{},
		{
			validate() {
				if (!chapter.title) {
					return 'Title is required'
				}
			},
			onSuccess() {
				outline.value?.reload()
				toast.success(__('Chapter updated successfully'))
				close()
			},
			onError(err: { messages?: string[] } | string) {
				toast.error(errorMessage(err))
			},
		}
	)
}

watch(
	() => props.chapterDetail,
	(newChapter) => {
		chapter.title = newChapter?.title ?? ''
		chapter.is_scorm_package = (newChapter?.is_scorm_package ?? 0) as 0 | 1
		chapter.scorm_package = (newChapter?.scorm_package ?? null) as ScormPackage
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
