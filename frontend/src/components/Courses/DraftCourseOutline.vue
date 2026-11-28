<template>
	<div class="rounded-5 border border-outline-gray-2 p-5">
		<div
			v-for="(chapter, chapterIndex) in chapters"
			:key="chapterIndex"
			data-testid="draft-chapter"
		>
			<div :class="ROW" class="px-2">
				<span
					class="lucide-chevron-down size-4 shrink-0 text-ink-gray-5"
					aria-hidden="true"
				/>
				<InlineText
					v-model="chapter.title"
					plain
					:placeholder="__('Chapter title')"
					:label="__('Chapter {0} title').format(chapterIndex + 1)"
					class="min-w-0 flex-1 text-p-base-medium text-ink-gray-9"
					@enter="addLesson(chapter)"
				/>
				<Button
					variant="ghost"
					size="sm"
					:label="__('Add lesson to chapter {0}').format(chapterIndex + 1)"
					:tooltip="__('Add lesson')"
					@click="addLesson(chapter)"
				>
					<template #icon><span class="lucide-plus size-4" /></template>
				</Button>
				<span class="text-p-sm tabular-nums text-ink-gray-6">
					{{ chapter.lessons.length }}
				</span>
				<Button
					v-if="chapters.length > 1"
					variant="ghost"
					size="sm"
					:label="__('Remove chapter {0}').format(chapterIndex + 1)"
					:class="REVEAL"
					@click="chapters.splice(chapterIndex, 1)"
				>
					<template #icon><span class="lucide-x size-4" /></template>
				</Button>
			</div>
			<div
				v-for="(_, lessonIndex) in chapter.lessons"
				:key="lessonIndex"
				:class="ROW"
				class="ms-6 px-2"
				data-testid="draft-lesson"
			>
				<span
					class="lucide-file-text size-4 shrink-0 text-ink-gray-5"
					aria-hidden="true"
				/>
				<InlineText
					v-model="chapter.lessons[lessonIndex]"
					plain
					:placeholder="__('Lesson title')"
					:label="__('Lesson {0} title').format(lessonIndex + 1)"
					class="min-w-0 flex-1 text-p-base text-ink-gray-8"
					@enter="addLesson(chapter)"
				/>
				<Button
					variant="ghost"
					size="sm"
					:label="__('Remove lesson {0}').format(lessonIndex + 1)"
					:class="REVEAL"
					@click="chapter.lessons.splice(lessonIndex, 1)"
				>
					<template #icon><span class="lucide-x size-4" /></template>
				</Button>
			</div>
		</div>
		<div class="pt-1">
			<Button variant="ghost" @click="addChapter">
				<template #prefix><span class="lucide-plus size-4" /></template>
				{{ __('New chapter') }}
			</Button>
		</div>
	</div>
</template>

<script setup lang="ts">
import { Button } from 'frappe-ui'
import InlineText from '@/components/InlineEdit/InlineText.vue'
import type { DraftChapter } from '@/composables/useCourseDraft'

/** A new course's outline as titles only; it is created with the course. */
const chapters = defineModel<DraftChapter[]>({ required: true })

/** The whole row fills on hover, and while editing so the caret's row shows. */
const ROW =
	'group/row flex min-h-9 items-center gap-2 rounded-4 transition-colors hover:bg-surface-gray-2 focus-within:bg-surface-gray-2'
const REVEAL =
	'opacity-0 focus:opacity-100 group-focus-within/row:opacity-100 group-hover/row:opacity-100'

const addLesson = (chapter: DraftChapter): void => {
	chapter.lessons.push('')
}

const addChapter = (): void => {
	chapters.value.push({ title: '', lessons: [''] })
}
</script>
