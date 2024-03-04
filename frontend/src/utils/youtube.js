export default class YouTubeVideo {
	constructor({ data }) {
		this.data = data
	}

	static get toolbox() {
		return {
			title: 'YouTube Video',
			icon: `<img src="/assets/lms/icons/video.svg" width="15" height="15">`,
		}
	}

	render() {
		this.wrapper = document.createElement('div')
		if (this.data && this.data.youtube) {
			$(this.wrapper).html(this.render_youtube(this.data.youtube))
		} else {
			this.render_youtube_dialog()
		}
		return this.wrapper
	}

	render_youtube_dialog() {
		let me = this
		let youtubedialog = new frappe.ui.Dialog({
			title: __('YouTube Video'),
			fields: [
				{
					fieldname: 'youtube',
					fieldtype: 'Data',
					label: __('YouTube Video ID'),
					reqd: 1,
				},
				{
					fieldname: 'instructions_section_break',
					fieldtype: 'Section Break',
					label: __('Instructions:'),
				},
				{
					fieldname: 'instructions',
					fieldtype: 'HTML',
					label: __('Instructions'),
					options: __(
						'Enter the YouTube Video ID. The ID is the part of the URL after <code>watch?v=</code>. For example, if the URL is <code>https://www.youtube.com/watch?v=QH2-TGUlwu4</code>, the ID is <code>QH2-TGUlwu4</code>'
					),
				},
			],
			primary_action_label: __('Insert'),
			primary_action(values) {
				youtubedialog.hide()
				me.youtube = values.youtube
				$(me.wrapper).html(me.render_youtube(values.youtube))
			},
		})
		youtubedialog.show()
	}

	render_youtube(youtube) {
		return `<iframe width="100%" height="400"
			src="https://www.youtube.com/embed/${youtube}"
			title="YouTube video player"
			frameborder="0"
			style="border-radius: var(--border-radius-lg); margin: 1rem 0;"
			allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
			allowfullscreen>
		</iframe>`
	}

	validate(savedData) {
		return !savedData.youtube || !savedData.youtube.trim() ? false : true
	}

	save(block_content) {
		return {
			youtube: this.data.youtube || this.youtube,
		}
	}
}
