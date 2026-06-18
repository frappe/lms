<template>
	<Dialog v-model:open="show" size="5xl" :title="__('How to edit a lesson')">
		<template #default>
			<div class="space-y-2 text-ink-gray-9">
				<details
					v-for="topic in helpTopics"
					:key="topic.key"
					:open="openKey === topic.key || leaving.has(topic.key)"
					class="rounded-md border border-outline-gray-2"
				>
					<summary
						class="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-p-base font-medium text-ink-gray-8"
						@click.prevent="toggle(topic.key)"
					>
						{{ __(topic.title) }}
						<span
							class="lucide-chevron-down size-4 shrink-0 text-ink-gray-5 transition-transform"
							:class="{ 'rotate-180': openKey === topic.key }"
						/>
					</summary>
					<Transition
						name="accordion"
						@before-leave="leaving.add(topic.key)"
						@after-leave="leaving.delete(topic.key)"
					>
						<div v-if="openKey === topic.key" class="accordion-panel grid">
							<div class="overflow-hidden">
								<div class="flex flex-col gap-5 px-4 pb-4 md:flex-row">
									<p
										class="text-p-sm leading-5 text-ink-gray-6"
										:class="topic.video ? 'md:w-2/5' : 'w-full'"
									>
										{{ __(topic.description) }}
									</p>
									<div v-if="topic.video" class="md:w-3/5">
										<VideoBlock :file="topic.video" />
									</div>
								</div>
							</div>
						</div>
					</Transition>
				</details>
			</div>
		</template>
	</Dialog>
</template>
<script setup>
import { ref } from 'vue'
import { Dialog } from 'frappe-ui'
import VideoBlock from '@/components/VideoBlock.vue'

const show = defineModel()

// One ordered list — the text-only Instructor Notes topic first, then the four
// videoed topics. Video paths are the static assets ExplanationVideos.vue used
// to map by `type`; inlining them here lets the video sit in the open accordion
// instead of a second modal.
const helpTopics = [
	{
		key: 'instructor_notes',
		title: 'What are Instructor Notes?',
		description:
			'Instructor Notes are private notes that only instructors can see. They can be used to provide additional context or guidance for the lesson.',
	},
	{
		key: 'quiz',
		title: 'How to add a Quiz?',
		description:
			'Click on the add icon in the editor and select Quiz from the menu. It opens up a dialog, where you can either select a quiz from the list or create a new quiz. When you select the Create New option it redirects you to the quiz creation page.',
		video: '/assets/lms/frontend/Quiz.mp4',
	},
	{
		key: 'upload',
		title: 'How to upload content from your system?',
		description:
			'To upload Image, Video, Audio or PDF from your system, click on the add icon and select upload from the menu. Then choose the file you want to add to the lesson and it gets added to your lesson.',
		video: '/assets/lms/frontend/Upload.mp4',
	},
	{
		key: 'youtube',
		title: 'How to add a YouTube Video?',
		description:
			'Copy the URL of the video from YouTube and paste it in the editor.',
		video: '/assets/lms/frontend/Youtube.mp4',
	},
	{
		key: 'remove',
		title: 'How to remove an embed?',
		description:
			'To remove an embed like YouTube or Vimeo, put your cursor on the line below the embed, then drag your mouse cursor upwards to select the embed. Once the embed is selected press BackSpace.',
		video: '/assets/lms/frontend/Remove.mp4',
	},
]

// Single-open accordion: the first topic starts open; clicking a summary opens
// that topic (closing any other) or collapses it if it was already open.
const openKey = ref(helpTopics[0].key)
// Native <details> hides its content the instant `open` is removed, which would
// preempt the Vue leave transition (closing would snap). Keep each element open
// for the duration of its collapse animation, then let it close. A Set (not a
// single key) so overlapping leaves during rapid topic-switching all animate.
const leaving = ref(new Set())
const toggle = (key) => {
	openKey.value = openKey.value === key ? null : key
}
</script>
<style scoped>
/* Smooth accordion open/close: animate the grid track from 0fr to 1fr so the
   panel's natural height expands/collapses without a hardcoded max-height. The
   inner overflow-hidden wrapper is what the collapsing track clips. */
.accordion-panel {
	grid-template-rows: 1fr;
}
.accordion-enter-active,
.accordion-leave-active {
	transition: grid-template-rows 0.28s ease, opacity 0.28s ease;
}
.accordion-enter-from,
.accordion-leave-to {
	grid-template-rows: 0fr;
	opacity: 0;
}
</style>
