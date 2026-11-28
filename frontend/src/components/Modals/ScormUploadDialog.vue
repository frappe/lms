<template>
	<Dialog v-model:open="open" :title="__('Upload SCORM packages')">
		<template #default>
			<p class="-mt-2 mb-4 text-p-base text-ink-gray-6">
				{{
					__(
						'Each package becomes its own chapter, in the order below. Learners open it inside the course and their progress is tracked from it.'
					)
				}}
			</p>
			<button
				type="button"
				data-testid="scorm-drop"
				class="flex w-full flex-col items-center gap-1 rounded-6 border border-dashed border-outline-gray-3 px-4 py-6 hover:bg-surface-gray-1"
				:disabled="adding"
				@click="fileInput?.click()"
				@dragover.prevent
				@drop.prevent="pickFiles(($event as DragEvent).dataTransfer?.files)"
			>
				<span class="lucide-file-archive mb-1 size-5 text-ink-gray-6" />
				<span class="text-base-medium text-ink-gray-8">
					{{ packages.length ? __('Add more packages') : __('Add packages') }}
				</span>
				<span class="text-p-sm text-ink-gray-6">
					{{ __('SCORM 1.2 or 2004 · select several at once') }}
				</span>
			</button>
			<input
				ref="fileInput"
				type="file"
				accept=".zip"
				multiple
				class="hidden"
				@change="onInputChange"
			/>
			<ol
				v-if="packages.length"
				class="mt-3 divide-y divide-outline-gray-1 rounded-6 border border-outline-gray-2"
			>
				<li
					v-for="(item, index) in packages"
					:key="item.id"
					data-testid="scorm-package"
					class="flex items-center gap-3 py-2.5 pe-2 ps-4"
				>
					<span class="w-4 text-p-sm tabular-nums text-ink-gray-6">
						{{ index + 1 }}
					</span>
					<div class="min-w-0 flex-1">
						<div class="truncate text-base-medium text-ink-gray-9">
							{{ item.title }}
						</div>
						<div class="truncate text-p-sm text-ink-gray-6">
							{{ item.file.name }} · {{ getFileSize(item.file.size) }}
						</div>
					</div>
					<Button
						variant="ghost"
						:label="__('Remove {0}').format(item.file.name)"
						:disabled="adding"
						@click="remove(item.id)"
					>
						<template #icon>
							<span class="lucide-x size-4" />
						</template>
					</Button>
				</li>
			</ol>
		</template>
		<template #actions>
			<div class="flex items-center justify-end gap-2">
				<Button variant="subtle" :disabled="adding" @click="open = false">
					{{ __('Cancel') }}
				</Button>
				<Button
					variant="solid"
					data-testid="scorm-submit"
					:disabled="!packages.length"
					:loading="adding"
					@click="addChapters"
				>
					{{ submitLabel }}
				</Button>
			</div>
		</template>
	</Dialog>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Button, call, Dialog, FileUploadHandler, toast } from 'frappe-ui'
import { getFileSize } from '@/utils/'
import { resourceErrorMessage } from '@/utils/resource'

interface ScormPackage {
	id: number
	title: string
	file: File
}

const props = defineProps<{ courseName: string }>()
const emit = defineEmits<{ added: [] }>()
const open = defineModel<boolean>('open', { default: false })

const fileInput = ref<HTMLInputElement | null>(null)
const packages = ref<ScormPackage[]>([])
const adding = ref(false)
let nextId = 0

const submitLabel = computed(() =>
	packages.value.length > 1
		? __('Add {0} chapters').format(packages.value.length)
		: __('Add chapter')
)

watch(open, (isOpen) => {
	if (!isOpen) packages.value = []
})

// "lms-dashboard_brief.zip" -> "Lms dashboard brief"
const titleFromFileName = (fileName: string): string => {
	const words = fileName
		.replace(/\.zip$/i, '')
		.replace(/[-_]+/g, ' ')
		.trim()
	return words.charAt(0).toUpperCase() + words.slice(1)
}

function pickFiles(files?: FileList | null) {
	for (const file of Array.from(files ?? [])) {
		if (!file.name.toLowerCase().endsWith('.zip')) {
			toast.error(__('{0} is not a ZIP file').format(file.name))
			continue
		}
		packages.value.push({
			id: nextId++,
			title: titleFromFileName(file.name),
			file,
		})
	}
}

function onInputChange(event: Event) {
	const input = event.target as HTMLInputElement
	pickFiles(input.files)
	input.value = ''
}

function remove(id: number) {
	packages.value = packages.value.filter((item) => item.id !== id)
}

async function addChapter(item: ScormPackage) {
	const file = await new FileUploadHandler().upload(item.file, {
		private: true,
	})
	await call('lms.lms.api.upsert_chapter', {
		title: item.title,
		course: props.courseName,
		is_scorm_package: 1,
		scorm_package: file,
	})
}

// One at a time, so chapters land in the listed order. A failed package stays
// listed to retry; the rest carry on.
async function addChapters() {
	adding.value = true
	const failed: ScormPackage[] = []
	for (const item of packages.value) {
		try {
			await addChapter(item)
		} catch (error) {
			failed.push(item)
			toast.error(`${item.file.name}: ${resourceErrorMessage(error)}`)
		}
	}
	adding.value = false
	const added = packages.value.length - failed.length
	if (added) {
		emit('added')
		toast.success(
			added === 1
				? __('Chapter added successfully')
				: __('{0} chapters added').format(added)
		)
	}
	packages.value = failed
	if (!failed.length) open.value = false
}
</script>
