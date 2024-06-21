import AudioBlock from '@/components/AudioBlock.vue'
import VideoBlock from '@/components/VideoBlock.vue'
import { createApp } from 'vue'

export class Upload {
	constructor({ data, api, readOnly }) {
		this.data = data
		this.readOnly = readOnly
	}

	static get isReadOnlySupported() {
		return true
	}

	render() {
		this.wrapper = document.createElement('div')
		this.renderUpload(this.data)
		return this.wrapper
	}

	renderUpload(file) {
		if (this.isVideo(file.file_type)) {
			const app = createApp(VideoBlock, {
				file: file.file_url,
			})
			app.mount(this.wrapper)
			return
		} else if (this.isAudio(file.file_type)) {
			const app = createApp(AudioBlock, {
				file: file.file_url,
			})
			app.mount(this.wrapper)
			return
		} else if (file.file_type == 'PDF') {
			this.wrapper.innerHTML = `<iframe src="${encodeURI(
				file.file_url
			)}#toolbar=0" width='100%' height='700px' class="mb-4"></iframe>`
			return
		} else {
			this.wrapper.innerHTML = `<img class="mb-4" src=${encodeURI(
				file.file_url
			)} width='100%'>`
			return
		}
	}

	save(blockContent) {
		return {
			file_url: this.data.file_url,
			file_type: this.data.file_type,
		}
	}

	isVideo(type) {
		return ['mov', 'mp4', 'avi', 'mkv', 'webm'].includes(type.toLowerCase())
	}

	isAudio(type) {
		return ['mp3', 'wav', 'ogg'].includes(type.toLowerCase())
	}
}
