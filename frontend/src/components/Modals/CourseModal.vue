<template>
	<Dialog v-model="show">
		<template #body>
			<div class="p-5">
				<div class="text-2xl font-semibold mb-5">
					{{ title }}
				</div>

				<div v-if="!scormSelected" class="flex items-center space-x-5">
					<div
						class="shadow rounded-md cursor-pointer hover:bg-gray-50 w-full p-4"
					>
						<router-link
							:to="{
								name: 'CourseForm',
								params: { courseName: 'new' },
							}"
							class="flex flex-col items-center space-y-2"
						>
							<FileText class="size-10 stroke-1.5 text-blue-500" />
							<div class="text-sm text-gray-600">
								{{ __('Course Form') }}
							</div>
						</router-link>
					</div>
					<div
						@click="renderScormForm()"
						class="flex flex-col items-center space-y-2 shadow rounded-md cursor-pointer hover:bg-gray-50 w-full p-4"
					>
						<FolderCog class="size-10 stroke-1.5 text-orange-500" />
						<div class="text-sm text-gray-600">
							{{ __('SCORM Package') }}
						</div>
					</div>
				</div>

				<div v-else>
					<input
						ref="folderInput"
						type="file"
						webkitdirectory="true"
						class="hidden"
						@change="addFolder"
					/>
					<Button @click="openFileSelector()">
						{{ __('Upload a Folder') }}
					</Button>
				</div>
			</div>
		</template>
	</Dialog>
</template>
<script setup>
import { Dialog, Button, createResource } from 'frappe-ui'
import { FileText, FolderCog } from 'lucide-vue-next'
import { ref, reactive, inject } from 'vue'

const show = defineModel()
const title = ref(__('Select a method'))
const scormSelected = ref(false)
const folderInput = ref(null)
const course = reactive({})
const user = inject('$user')

const renderScormForm = () => {
	scormSelected.value = true
	title.value = __('Select SCORM Package')
}

const openFileSelector = () => {
	folderInput.value.click()
}

const uploadFolder = createResource({
	url: 'frappe.core.api.file.create_new_folder',
	makeParams(values) {
		return {
			file_name: values.file_name,
			folder: values.folder,
		}
	},
})

const uploadFile = createResource({
	url: '/api/method/upload_file',
	makeParams(values) {
		return {
			file_name: values.file_name,
			file_url: values.file_url,
			is_private: true,
			is_folder: false,
			folder: values.folder,
		}
	},
})

const addFolder = (e) => {
	const files = e.target.files
	console.log(files)

	const manifest = Array.from(files).find(
		(file) => file.name == 'imsmanifest.xml'
	)
	console.log(manifest)
	if (manifest) {
		readManifest(manifest)
	}

	/* Array.from(files).forEach((file) => {
        let folders = file.webkitRelativePath.split('/')
        folders.forEach((folder, index) => {
            if (index != folders.length - 1) {
                uploadFolder.submit({
                    file_name: folder,
                    folder: index == 0 ? "Home": folders[index - 1]
                })
            } else {
                uploadFile.submit({
                    file_name: folder,
                    file_url: file,
                    folder: folders[index - 1]
                })
            }
        })
    }) */
}

const readManifest = (file) => {
	return new Promise((resolve) => {
		const reader = new FileReader()
		reader.onload = function () {
			parseManifest(reader.result)
		}
		reader.onerror = (e) => {
			console.error(e)
		}
		reader.readAsText(file)
	})
}

const parseManifest = (result) => {
	const xmlString = result
	const parser = new DOMParser()
	const xml = parser.parseFromString(xmlString, 'text/xml')

	const organizations = xml.getElementsByTagName('organizations')[0]
	const organization = organizations.getElementsByTagName('organization')[0]
	course.title = organization.getElementsByTagName('title')[0].textContent
	console.log('Course Title:', course.title)

	const metadata = organization.getElementsByTagName('metadata')[0]
	course.description = metadata
		.getElementsByTagName('description')[0]
		.getElementsByTagName('string')[0].textContent
	console.log('Course Description:', course.description)

	// Extract course items (SCOs and titles)
	const items = organization.getElementsByTagName('item')
	for (let i = 0; i < items.length; i++) {
		const itemTitle = items[i].getElementsByTagName('title')[0].textContent
		console.log('Course Item:', itemTitle)
	}

	// Extract resources
	const resources = xml.getElementsByTagName('resource')
	course.image = null
	console.log('Resources:', resources)
	Array.from(resources).forEach((resource) => {
		const resourceFile = resource.getAttribute('href')
		console.log('Resource File:', resourceFile)
		const files = resource.getElementsByTagName('file')
		if (!course.image) {
			Array.from(files).forEach((file) => {
				const href = file.getAttribute('href')
				// Check if it's an image file (you can expand this to include more formats if needed)
				if (
					href.endsWith('.jpg') ||
					href.endsWith('.png') ||
					href.endsWith('.gif')
				) {
					imageResource.submit({ image: href })
					return
				}
			})
		}
	})

	createCourse()
}

const newCourse = createResource({
	url: 'frappe.client.insert',
	makeParams(values) {
		return {
			doc: {
				doctype: 'LMS Course',
				short_introduction: course.description,
				instructors: [user.data?.name],
				...course,
			},
		}
	},
})

const createCourse = () => {
	newCourse.submit(
		{},
		{
			onSuccess(data) {
				console.log(data)
			},
		}
	)
}

const imageResource = createResource({
	url: 'lms.lms.api.get_file_info',
	makeParams(values) {
		console.log(values)
		return {
			file_url: values.image,
		}
	},
	auto: false,
	onSuccess(data) {
		course.image = data
	},
})
</script>
