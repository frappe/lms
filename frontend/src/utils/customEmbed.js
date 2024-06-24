import Embed from '@editorjs/embed'
import VideoBlock from '@/components/VideoBlock.vue'
import { createApp } from 'vue'

export class CustomEmbed extends Embed {
	render() {
		const container = super.render()
		const { service, source, embed } = this.data

		if (service === 'youtube' || service === 'vimeo') {
			// Remove the iframe or existing embed content
			container.innerHTML = ''

			// Create a placeholder element for Vue component
			const vueContainer = document.createElement('div')
			vueContainer.setAttribute('data-service', service)
			vueContainer.setAttribute('data-video-id', this.data.source)

			// Append the Vue placeholder
			container.appendChild(vueContainer)
			console.log(source)
			// Mount the Vue component (using a global Vue instance)
			const app = createApp(VideoBlock, {
				file: source,
				type: 'video/youtube',
			})
			app.mount(vueContainer)
		}

		return container
	}
}
