<template>
	<TeacherPage :breadcrumbs="breadcrumbs" :state="page">
		<div class="space-y-6">
			<div>
				<h1 class="text-lg-semibold text-ink-gray-9">
					{{ __('New course from documents') }}
				</h1>
				<p class="mt-1 max-w-3xl text-p-base text-ink-gray-5">
					{{
						__(
							'Upload the slides, syllabus, exercises and grading criteria you already have. The assistant drafts chapters, lessons, assignments and rubrics that cite your pages. Nothing is created until you approve the draft.'
						)
					}}
				</p>
			</div>

			<form
				class="space-y-4 rounded-6 border border-outline-gray-2 p-5"
				data-testid="copilot-import-form"
				@submit.prevent="submit"
			>
				<FormControl
					v-model="title"
					type="text"
					:label="__('Course title')"
					:placeholder="__('e.g. Python for beginners')"
					:maxlength="140"
					required
					data-testid="copilot-import-title"
				/>
				<div class="space-y-1.5">
					<label
						for="copilot-import-files"
						class="block text-xs text-ink-gray-5"
					>
						{{
							__('Documents (PDF, DOCX, PPTX, Markdown, text; up to 10 files)')
						}}
					</label>
					<input
						id="copilot-import-files"
						ref="fileInput"
						type="file"
						multiple
						:accept="ACCEPT"
						class="block w-full text-p-base text-ink-gray-7 file:me-3 file:rounded file:border-0 file:bg-surface-gray-2 file:px-3 file:py-1.5 file:text-ink-gray-8 hover:file:bg-surface-gray-3"
						data-testid="copilot-import-files"
						@change="onFiles"
					/>
					<ul v-if="files.length" class="text-p-sm text-ink-gray-5">
						<li v-for="file in files" :key="file.name">{{ file.name }}</li>
					</ul>
				</div>
				<FormControl
					v-model="brief"
					type="textarea"
					:rows="3"
					:label="__('Brief for the assistant')"
					:placeholder="
						__('Audience, goals, and topics the outline must cover (optional)')
					"
				/>
				<div class="flex justify-end">
					<Button
						type="submit"
						variant="solid"
						:loading="uploading"
						:label="uploading ? __('Uploading…') : __('Draft the course')"
						data-testid="copilot-import-submit"
					/>
				</div>
			</form>

			<template v-if="imports.length">
				<h2 class="text-base-semibold text-ink-gray-9">
					{{ __('Earlier imports') }}
				</h2>
				<div class="overflow-x-auto rounded-6 border border-outline-gray-2">
					<table class="w-full text-p-base">
						<tbody>
							<tr
								v-for="row in imports"
								:key="row.name"
								class="border-b border-outline-gray-1 last:border-b-0"
								data-testid="copilot-import-row"
							>
								<td class="px-3 py-2">
									<router-link
										:to="{
											name: 'CopilotImportDetail',
											params: { importName: row.name },
										}"
										class="text-ink-gray-9 underline"
									>
										{{ row.title }}
									</router-link>
								</td>
								<td class="px-3 py-2 text-ink-gray-6">
									{{
										(row.sources || [])
											.map((source) => source.file_name)
											.join(', ')
									}}
								</td>
								<td class="px-3 py-2">
									<TeacherStatusBadge :status="row.status" />
								</td>
								<td
									class="whitespace-nowrap px-3 py-2 text-p-sm text-ink-gray-5"
								>
									{{ formatDate(row.created) }}
								</td>
							</tr>
						</tbody>
					</table>
				</div>
			</template>
		</div>
	</TeacherPage>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Button, FormControl, toast, usePageMeta } from 'frappe-ui'
import TeacherPage from '@/components/Copilot/teacher/TeacherPage.vue'
import TeacherStatusBadge from '@/components/Copilot/teacher/TeacherStatusBadge.vue'
import { useTeacherData } from '@/components/Copilot/teacher/useTeacherData'
import { runAction } from '@/components/Copilot/teacher/actions'
import { formatDate } from '@/components/Copilot/teacher/format'
import { copilotCall, uploadCourseSource } from '@/copilot/api'

const ACCEPT = '.pdf,.docx,.pptx,.md,.markdown,.txt'
const MAX_FILES = 10

const router = useRouter()
const title = ref('')
const brief = ref('')
const files = ref([])
const fileInput = ref(null)
const uploading = ref(false)

const page = useTeacherData(() => copilotCall('list_course_imports'))
const imports = computed(() => page.data.value || [])

const breadcrumbs = computed(() => [
	{ label: __('Review queue'), route: { name: 'CopilotQueue' } },
	{ label: __('New course from documents'), route: { name: 'CopilotImports' } },
])

function onFiles(event) {
	files.value = Array.from(event.target.files || [])
}

async function submit() {
	if (!title.value.trim()) {
		toast.error(__('Enter a course title.'))
		return
	}
	if (!files.value.length) {
		fileInput.value?.focus()
		toast.error(__('Choose at least one document.'))
		return
	}
	if (files.value.length > MAX_FILES) {
		toast.error(__('Upload at most {0} files.').format(MAX_FILES))
		return
	}
	uploading.value = true
	const result = await runAction(async () => {
		const urls = []
		for (const file of files.value) {
			const uploaded = await uploadCourseSource(file)
			urls.push(uploaded.file_url)
		}
		return copilotCall('create_course_import', {
			title: title.value.trim(),
			brief: brief.value.trim(),
			files: urls,
		})
	})
	uploading.value = false
	if (result) {
		router.push({
			name: 'CopilotImportDetail',
			params: { importName: result.name },
		})
	}
}

usePageMeta(() => ({ title: __('New course from documents') }))
</script>
