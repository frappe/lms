class ImageTool {
	constructor({ data, api }) {
		this.api = api
		this.data = data
		this.wrapper = undefined
	}

	static get toolbox() {
		return {
			title: 'Image',
			icon: '<svg width="18" height="18" viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zm-2 0H5V5h14v14zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>',
		}
	}

	render() {
		this.wrapper = document.createElement('div')
		this.wrapper.classList.add('image-tool')

		if (this.data && this.data.url) {
			this._createImage(this.data.url)
		}

		this.wrapper.addEventListener('paste', (event) => {
			this._handlePaste(event)
		})

		return this.wrapper
	}

	_createImage(url) {
		const image = document.createElement('img')
		image.src = url
		image.classList.add('image-tool__image')
		this.wrapper.innerHTML = ''
		this.wrapper.appendChild(image)

		const resizeObserver = new ResizeObserver(() => {
			image.style.width = `${this.wrapper.clientWidth}px`
		})
		resizeObserver.observe(this.wrapper)
	}

	_handlePaste(event) {
		const clipboardData = event.clipboardData || window.clipboardData
		const items = clipboardData.items
		for (let i = 0; i < items.length; i++) {
			if (items[i].type.indexOf('image') !== -1) {
				const file = items[i].getAsFile()
				const reader = new FileReader()
				reader.onload = (e) => {
					this._createImage(e.target.result)
				}
				reader.readAsDataURL(file)
			}
		}
	}

	save(blockContent) {
		const img = blockContent.querySelector('img')
		return {
			url: img.src,
		}
	}
}
