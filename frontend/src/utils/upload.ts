import AudioBlock from '@/components/AudioBlock.vue'
import { registerDirectives } from '@/directives'
import VideoBlock from '@/components/VideoBlock.vue'
import PdfBlock from '@/components/PdfBlock.vue'
import UploadPlugin from '@/components/UploadPlugin.vue'
import { h, createApp } from 'vue'
import type { App } from 'vue'
import { Upload as UploadIcon } from 'lucide-vue-next'
// @ts-expect-error utils/dialogs.js has no type declarations yet
import { createDialog } from '@/utils/dialogs'
import { usesWebkitPdfViewer } from '@/utils/pdfViewer'
import { embedFrame } from '@/utils/blockDom'
import { safeUrl } from '@/utils/safeUrl'
import translationPlugin from '../translation'

// What the block saves: an uploaded file and, for a video, its in-video quizzes.
interface UploadData {
	file_url?: string
	file_type?: string
	quizzes?: VideoQuiz[]
}

interface VideoQuiz {
	quiz: string
	time: number
}

interface UploadedFile {
	file_url: string
	file_type: string
	quizzes?: VideoQuiz[]
}

// An iframe cannot clip its own corners in every browser, so it sits in a
// rounded wrapper.
const embedCard = (child: HTMLElement): HTMLDivElement => {
	const card = document.createElement('div')
	card.className = 'overflow-hidden rounded-7'
	card.append(child)
	return card
}

export class Upload {
	data: UploadData
	readOnly: boolean
	config: Record<string, unknown>
	wrapper!: HTMLDivElement
	app: App | null = null

	constructor({
		data,
		config,
		readOnly,
	}: {
		data: UploadData
		api?: unknown
		config?: Record<string, unknown>
		readOnly: boolean
	}) {
		this.data = data
		this.readOnly = readOnly
		this.config = config || {}
	}

	static get toolbox() {
		const app = createApp({
			render: () => h(UploadIcon, { size: 18, strokeWidth: 1.5 }),
		})
		registerDirectives(app)

		const div = document.createElement('div')
		app.mount(div)

		return {
			title: 'Upload',
			icon: div.innerHTML,
		}
	}

	static get isReadOnlySupported() {
		return true
	}

	render(): HTMLDivElement {
		this.wrapper = document.createElement('div')

		if (this.data && this.data.file_url) {
			this.renderFile(this.data as UploadedFile)
		} else {
			this.renderFileUploader()
		}

		return this.wrapper
	}

	renderFile(file: UploadedFile): void {
		this.wrapper.className = 'not-prose my-5'
		if (this.isVideo(file.file_type)) {
			const app = createApp(VideoBlock, {
				file: file.file_url,
				readOnly: this.readOnly,
				quizzes: file.quizzes || [],
				saveQuizzes: (quizzes: VideoQuiz[]) => {
					if (this.readOnly) return
					this.data.quizzes = quizzes
				},
			})
			registerDirectives(app)
			app.use(translationPlugin)
			app.config.globalProperties.$dialog = createDialog
			app.mount(this.wrapper)
			return
		} else if (this.isAudio(file.file_type)) {
			const app = createApp(AudioBlock, {
				file: file.file_url,
			})
			registerDirectives(app)
			app.mount(this.wrapper)
			return
		} else if (file.file_type == 'PDF') {
			// WebKit refuses to scroll a PDF in an <iframe>, so it gets the inline
			// pdf.js viewer. mount()/unmount() is tracked so destroy() can tear the
			// pdf.js worker + render tasks down. Everywhere else keeps the native
			// plugin. See utils/pdfViewer.
			if (!usesWebkitPdfViewer()) {
				const frame = embedFrame(file.file_url, {
					width: '100%',
					height: '700px',
					class: 'block',
					type: 'application/pdf',
				})
				this.wrapper.replaceChildren(...(frame ? [embedCard(frame)] : []))
				return
			}
			this.app = createApp(PdfBlock, {
				file: file.file_url,
			})
			registerDirectives(this.app)
			this.app.use(translationPlugin)
			this.app.mount(this.wrapper)
			return
		} else {
			const src = safeUrl(file.file_url)
			if (src) {
				const img = document.createElement('img')
				img.setAttribute('src', src)
				img.className = 'block w-full rounded-7 overflow-hidden'
				img.setAttribute('width', '100%')
				this.wrapper.replaceChildren(img)
			}
			return
		}
	}

	renderFileUploader(): void {
		const app = createApp(UploadPlugin, {
			uploadContext: this.config,
			onFileUploaded: (file: UploadedFile) => {
				this.data.file_url = file.file_url
				this.data.file_type = file.file_type
				this.renderFile(file)
			},
		})
		registerDirectives(app)
		app.use(translationPlugin)
		app.mount(this.wrapper)
	}

	validate(savedData: UploadData): boolean {
		if (!savedData.file_url || !savedData.file_type) {
			return false
		}
		return true
	}

	save(): UploadData {
		return {
			file_url: this.data.file_url,
			file_type: this.data.file_type,
			quizzes: this.data.quizzes || [],
		}
	}

	// EditorJS calls destroy() when a block is removed or the editor is torn down.
	// Unmounting the PdfBlock app fires its onBeforeUnmount, which cancels render
	// tasks, destroys the document, and releases the shared pdf.js worker.
	destroy(): void {
		if (this.app) {
			this.app.unmount()
			this.app = null
		}
	}

	isVideo(type: string): boolean {
		return ['mov', 'mp4', 'avi', 'mkv', 'webm'].includes(type.toLowerCase())
	}

	isAudio(type: string): boolean {
		return ['mp3', 'wav', 'ogg'].includes(type.toLowerCase())
	}
}
