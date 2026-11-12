<template>
	<!-- 20px from each divider to the text, measured: the header's button and the rows'
	     own padding already add space, so the section pads only the rest. -->
	<section
		class="-mx-4 border-y border-outline-gray-1 px-4 pt-3 sm:-mx-6 sm:px-6"
		:class="sources.length ? 'pb-2.5' : 'pb-4'"
	>
		<!-- Rows bring their own padding; plain text under the heading needs the gap. -->
		<div
			class="flex items-center gap-2"
			:class="sources.length ? '-mb-1' : 'mb-1'"
		>
			<h3 class="flex-1 text-p-sm font-semibold text-ink-gray-7">
				{{ __('Material') }}
			</h3>
			<FileUploader
				:fileTypes="['.pdf', '.docx', '.txt', '.md']"
				:private="true"
				@success="(file) => addSource.submit({ goal, file_url: file.file_url })"
			>
				<template #default="{ openFileSelector, uploading, progress }">
					<span v-if="uploading" class="text-p-xs text-ink-gray-6">
						{{ __('Uploading {0}%').format(progress) }}
					</span>
					<Dropdown
						v-else
						:options="[
							{
								label: __('Upload a file'),
								icon: 'lucide-upload',
								onClick: openFileSelector,
							},
							{
								label: __('Add a course'),
								icon: 'lucide-book-open',
								onClick: () => (addingCourse = true),
							},
							{
								label: __('Add a web page'),
								icon: 'lucide-globe',
								onClick: () => (addingLink = true),
							},
						]"
					>
						<Button
							size="sm"
							variant="subtle"
							:tooltip="__('Add material')"
							:aria-label="__('Add material')"
							:loading="addSource.loading"
						>
							<template #icon>
								<span class="lucide-plus size-4 text-ink-gray-7" />
							</template>
						</Button>
					</Dropdown>
				</template>
			</FileUploader>
		</div>
		<p v-if="!sources.length" class="text-p-sm text-ink-gray-6">
			{{
				__(
					'Add a guide, a policy or a course to teach from, or just describe the goal below.'
				)
			}}
		</p>
		<ul v-else class="-mx-2 space-y-0.5">
			<li
				v-for="source in sources"
				:key="source.title"
				class="group rounded-4 px-2 py-1.5 hover:bg-surface-gray-1"
			>
				<div class="flex min-h-6 items-center gap-2.5">
					<span
						class="size-4 shrink-0 text-ink-gray-6"
						:class="
							source.url
								? 'lucide-globe'
								: source.course
								? 'lucide-book-open'
								: 'lucide-file-text'
						"
					/>
					<span class="min-w-0 flex-1 truncate text-p-sm text-ink-gray-8">
						{{ source.title }}
					</span>
					<LoadingIndicator
						v-if="source.status === 'Reading'"
						class="size-3.5 shrink-0"
					/>
					<Button
						v-else-if="
							source.status === 'Failed' &&
							(source.course || source.url || files[source.title])
						"
						size="sm"
						variant="ghost"
						:loading="
							addSource.loading || rereadCourse.loading || addUrl.loading
						"
						@click="tryAgain(source)"
					>
						{{ __('Try again') }}
					</Button>
					<!-- Remove waits for hover so the list reads calmly; keyboard focus and touch
					     screens, which have no hover, still show it. -->
					<Button
						v-if="source.status !== 'Reading'"
						size="sm"
						variant="ghost"
						class="opacity-0 focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
						:tooltip="__('Remove')"
						:aria-label="__('Remove {0}').format(source.title)"
						:loading="removeSource.loading && removing === source.title"
						@click="confirmRemove(source)"
					>
						<template #icon>
							<span class="lucide-x size-3.5 text-ink-gray-6" />
						</template>
					</Button>
				</div>
				<!-- What it is and how much was read, under the name, so the row's end stays free. -->
				<div
					class="ms-[1.625rem] mt-0.5 text-p-xs"
					:class="
						source.status === 'Failed' ? 'text-ink-red-6' : 'text-ink-gray-6'
					"
				>
					{{ statusText(source) }}
				</div>
				<Progress
					v-if="source.status === 'Reading' && source.total"
					class="ms-[1.625rem] mt-1.5"
					size="sm"
					:value="Math.round((source.page / source.total) * 100)"
				/>
			</li>
		</ul>
		<ErrorMessage
			class="mt-2"
			:message="addSource.error || removeSource.error || rereadCourse.error"
		/>
		<AddCourseDialog
			v-if="addingCourse"
			:goal="goal"
			@added="(sources) => emit('changed', sources as Source[])"
			@close="addingCourse = false"
		/>
		<AddLinkDialog
			v-if="addingLink"
			:goal="goal"
			@added="(sources) => emit('changed', sources as Source[])"
			@close="addingLink = false"
		/>
	</section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import {
	Button,
	createResource,
	Dropdown,
	ErrorMessage,
	FileUploader,
	LoadingIndicator,
	Progress,
} from 'frappe-ui'
import AddCourseDialog from '@/components/Goals/AddCourseDialog.vue'
import AddLinkDialog from '@/components/Goals/AddLinkDialog.vue'
import { createDialog } from '@/utils/dialogs'

interface Source {
	title: string
	pages: number
	status: string
	error?: string | null
	page?: number
	total?: number
	course?: string
	url?: string
	empty?: boolean
	videos_unread?: number
}

const props = withDefaults(
	defineProps<{
		goal: string
		sources: Source[]
		files?: Record<string, string>
	}>(),
	{
		files: () => ({}),
	}
)
const emit = defineEmits<{ changed: [sources: Source[]] }>()

const addSource = createResource({
	url: 'lms.lms.ai.api.add_source',
	onSuccess: (sources: Source[]) => emit('changed', sources),
})

const addingCourse = ref(false)
const addingLink = ref(false)
const addUrl = createResource({
	url: 'lms.lms.ai.api.add_url',
	onSuccess: (sources: Source[]) => emit('changed', sources),
})
const rereadCourse = createResource({
	url: 'lms.lms.ai.api.reread_course',
	onSuccess: (sources: Source[]) => emit('changed', sources),
})

const tryAgain = (source: Source) => {
	if (source.course)
		return rereadCourse.submit({ goal: props.goal, course: source.course })
	if (source.url) return addUrl.submit({ goal: props.goal, url: source.url })
	return addSource.submit({
		goal: props.goal,
		file_url: props.files[source.title],
	})
}

const removing = ref('')
const removeSource = createResource({
	url: 'lms.lms.ai.api.remove_source',
	onSuccess: (sources: Source[]) => emit('changed', sources),
	onFinally: () => (removing.value = ''),
})

// Removing a file changes what the tutor can teach from, so it asks first.
const confirmRemove = (source: Source) => {
	createDialog({
		title: __('Remove {0}?').format(source.title),
		message: source.course
			? __(
					'Lumi stops teaching from this course and the skill is no longer offered as practice on it. Plans you already built keep their wording. You can add it again later.'
			  )
			: source.url
			? __(
					"Lumi stops teaching from this page and can't cite it any more. Plans you already built keep their wording. You can add it again later."
			  )
			: __(
					"The AI stops teaching from this file. Plans you already built keep their wording, but Lumi can't cite it any more. You can add it again later."
			  ),
		actions: [
			{
				label: __('Remove'),
				theme: 'red',
				variant: 'solid',
				onClick({ close }: { close: () => void }) {
					removing.value = source.title
					removeSource
						.submit({ goal: props.goal, document: source.title })
						.then(close)
				},
			},
		],
	})
}

// Lumi reads what a video says from its captions or by listening; one it could not read stays silent.
const captionsNote = (source: Source) => {
	const count = source.videos_unread || 0
	if (!count) return ''
	return count === 1
		? __('1 video could not be read')
		: __('{0} videos could not be read').format(count)
}

const statusText = (source: Source) => {
	if (source.course && source.empty && source.status === 'Completed')
		return source.videos_unread
			? __(
					'Its videos could not be read yet. Captions on the video, or speech recognition on this site, let Lumi hear them.'
			  )
			: __(
					'No lesson text to read yet. Lessons with text are read as soon as they are saved.'
			  )
	if (source.course && source.status === 'Reading')
		return source.total
			? __(
					'Reading lesson {0} of {1}. You can keep working while it reads.'
			  ).format(source.page, source.total)
			: __('Getting ready to read…')
	if (source.course && source.status === 'Failed')
		return source.error || __("We couldn't read some lessons. Try again.")
	if (source.status === 'Completed' && source.course)
		return [
			source.pages === 1
				? __('Course · 1 lesson')
				: __('Course · {0} lessons').format(source.pages),
			captionsNote(source),
		]
			.filter(Boolean)
			.join(' · ')
	if (source.status === 'Completed' && source.url) return __('Web page')
	if (source.status === 'Completed')
		return source.pages === 1
			? __('Document · 1 page')
			: __('Document · {0} pages').format(source.pages)
	if (source.status === 'Reading')
		return source.total
			? __(
					'Reading page {0} of {1}. You can keep working while it reads.'
			  ).format(source.page, source.total)
			: __('Getting ready to read…')
	if (source.status === 'Failed' && source.url)
		return (
			source.error ||
			__("We couldn't read this page. Check the address opens for everyone.")
		)
	if (source.status === 'Failed')
		return (
			source.error || __("We couldn't read this file. Try a PDF or Word copy.")
		)
	return __('Reading…')
}
</script>
