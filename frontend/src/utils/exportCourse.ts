import { toast } from 'frappe-ui'

/**
 * Fetch the course-export zip and trigger a browser download with the
 * server-supplied filename. Surfaces errors via toast.
 */
export async function exportCourseAsZip(courseName: string): Promise<void> {
	try {
		const response = await fetch(
			'/api/method/lms.lms.api.export_course_as_zip?course_name=' +
				encodeURIComponent(courseName),
			{ method: 'GET', credentials: 'include' }
		)
		if (!response.ok) throw new Error('Download failed')
		const blob = await response.blob()
		const disposition = response.headers.get('Content-Disposition')
		let filename = 'course.zip'
		if (disposition && disposition.includes('filename=')) {
			filename = disposition.split('filename=')[1].replace(/"/g, '')
		}
		const url = window.URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = filename
		document.body.appendChild(a)
		a.click()
		a.remove()
		window.URL.revokeObjectURL(url)
	} catch (err) {
		console.error(err)
		toast.error(__('Export failed'))
	}
}
