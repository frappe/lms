
<template>
	<!-- YouTube video from the lesson field -->
	<div v-if="youtubeEmbedId(youtube)" :key="youtubeEmbedId(youtube)">
		<div
			class="video-player"
			data-plyr-provider="youtube"
			:data-plyr-embed-id="youtubeEmbedId(youtube)"
		></div>
	</div>

	<!-- Lesson content blocks -->
	<div
		v-for="(block, index) in content?.split('\n\n') || []"
		:key="`${index}:${block}`"
	>
		<!-- YouTube macro -->
		<div v-if="block.includes('{{ YouTubeVideo')">
			<div
				v-if="youtubeEmbedId(getId(block))"
				:key="youtubeEmbedId(getId(block))"
				class="video-player"
				data-plyr-provider="youtube"
				:data-plyr-embed-id="youtubeEmbedId(getId(block))"
			></div>
		</div>

		<!-- Quiz macro -->
		<div v-else-if="block.includes('{{ Quiz')">
			<Quiz
				v-if="getId(block)"
				:quiz="getId(block)"
			/>
		</div>

		<!-- Video macro -->
		<div v-else-if="block.includes('{{ Video')">
			<video
				v-if="getId(block)"
				controls
				width="100%"
				controlsList="nodownload"
				@contextmenu.prevent
			>
				<source
					:src="safeUrl(getId(block))"
					type="video/mp4"
				/>
			</video>
		</div>

		<!-- PDF macro -->
		<div v-else-if="block.includes('{{ PDF')">
			<PdfBlock
				v-if="inlinePdf && getId(block)"
				:key="`pdf:${index}:${getId(block)}`"
				:file="getId(block)"
				:session="session"
				:activity="activity"
				:student="student"
			/>

			<iframe
				v-else-if="getId(block)"
				:src="safeUrl(getId(block))"
				:title="__('PDF document')"
				width="100%"
				height="700px"
				class="mb-4"
				type="application/pdf"
			></iframe>
		</div>

		<!-- Audio macro -->
		<div v-else-if="block.includes('{{ Audio')">
			<audio
				v-if="getId(block)"
				controls
				controlsList="nodownload"
			>
				<source
					:src="safeUrl(getId(block))"
					type="audio/mp3"
				/>
			</audio>
		</div>

		<!-- Embed macro -->
		<div v-else-if="block.includes('{{ Embed')">
			<iframe
				v-if="getId(block)"
				width="100%"
				height="400"
				:src="safeUrl(getId(block))"
				:title="__('Embedded content')"
				frameborder="0"
				allowfullscreen
			></iframe>
		</div>

		<!-- Markdown content -->
		<div
			v-else
			v-safe-html:rich="renderMarkdown(block)"
		></div>
	</div>

	<!-- Quiz assigned directly to the lesson -->
	<div v-if="quizId">
		<Quiz :quiz="quizId" />
	</div>
</template>

<script setup>
import Quiz from '@/components/QuizBlock.vue'
import PdfBlock from '@/components/PdfBlock.vue'
import MarkdownIt from 'markdown-it'

import {
	extractYoutubeID,
	getMacroArg,
} from '@/utils/lessonMacros'

import { usesWebkitPdfViewer } from '@/utils/pdfViewer'
import { safeUrl } from '@/utils/safeUrl'

const props = defineProps({
	content: {
		type: String,
		required: true,
	},

	youtube: {
		type: String,
		required: false,
		default: '',
	},

	quizId: {
		type: String,
		required: false,
		default: '',
	},

	// Learning journey tracking data
	session: {
		type: String,
		required: false,
		default: '',
	},

	activity: {
		type: String,
		required: false,
		default: '',
	},

	student: {
		type: String,
		required: false,
		default: '',
	},
})

const inlinePdf = usesWebkitPdfViewer()

const markdown = new MarkdownIt({
	html: true,
	linkify: true,
})

/**
 * Render Markdown content safely.
 */
const renderMarkdown = (block) => {
	return markdown.render(block)
}

/**
 * Safely extract the argument from a lesson macro.
 *
 * Example:
 * {{ PDF(https://example.com/file.pdf) }}
 */
const getId = (block) => {
	return getMacroArg(block) ?? ''
}

/**
 * Extract the YouTube video ID.
 *
 * Invalid or empty sources return an empty string.
 */
const youtubeEmbedId = (source) => {
	return source ? extractYoutubeID(source) : ''
}
</script>
