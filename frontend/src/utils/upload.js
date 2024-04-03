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
		this.wrapper.innerHTML = this.renderUpload(this.data)
		return this.wrapper
	}

	renderUpload(file) {
		if (this.isVideo(file.file_type)) {
			return `<video controls width='100%' controls controlsList='nodownload' class="mb-4">
				<source src=${encodeURI(file.file_url)} type='video/mp4'>
			</video>`
		} else if (this.isAudio(file.file_type)) {
			return `<audio controls width='100%' controls controlsList='nodownload' class="mb-4">
				<source src=${encodeURI(file.file_url)} type='audio/mp3'>
			</audio>`
		} else if (file.file_type == 'pdf') {
			return `<iframe src="${encodeURI(
				file.file_url
			)}#toolbar=0" width='100%' height='700px' class="mb-4"></iframe>`
		} else {
			return `<img class="mb-4" src=${encodeURI(
				file.file_url
			)} width='100%'>`
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
