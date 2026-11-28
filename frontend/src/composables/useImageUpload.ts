import { ref } from 'vue'
import type { Ref } from 'vue'
import { FileUploadHandler, toast } from 'frappe-ui'

export const IMAGE_ACCEPT = '.jpg,.jpeg,.png'

const isImage = (file: File): boolean =>
	/\.(jpe?g|png)$/i.test(file.name) || /^image\/(jpeg|png)$/.test(file.type)

/** Uploads one picked or dropped image as a public file into `image`. */
export function useImageUpload(image: Ref<string | null | undefined>) {
	const uploading = ref<boolean>(false)

	async function upload(file: File | undefined): Promise<void> {
		if (!file) return
		if (!isImage(file)) {
			toast.error(__('Pick a JPG or PNG image.'))
			return
		}
		uploading.value = true
		try {
			const saved = await new FileUploadHandler().upload(file, {
				private: false,
			})
			image.value = saved.file_url
		} catch {
			toast.error(__('Error uploading file'))
		} finally {
			uploading.value = false
		}
	}

	const onDrop = (event: DragEvent): Promise<void> =>
		upload(event.dataTransfer?.files?.[0])

	function onPick(event: Event): void {
		const target = event.target as HTMLInputElement
		upload(target.files?.[0])
		target.value = ''
	}

	return { uploading, onDrop, onPick }
}
