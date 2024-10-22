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
						@change="processFolder"
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
import { Dialog, Button, createResource, FileUploadHandler } from 'frappe-ui'
import { FileText, FolderCog } from 'lucide-vue-next'
import { ref, reactive, inject } from 'vue'
import { showToast } from '@/utils'
import { useRouter } from 'vue-router'

const router = useRouter()
const show = defineModel()
const title = ref(__('Select a method'))
const scormSelected = ref(false)
const folderInput = ref(null)
const user = inject('$user')
const chapters = ref([])
const uploader = new FileUploadHandler()
const files = ref([])

const course = reactive({
	name: '',
	title: '',
	description: '',
	image: null,
})

const renderScormForm = () => {
	scormSelected.value = true
	title.value = __('Select SCORM Package')
}

const openFileSelector = () => {
	folderInput.value.click()
}

const processFolder = (e) => {
	files.value = e.target.files

	const images = Array.from(files.value).filter((file) => {
		return isImage(file.type)
	})
	if (images.length) {
		course.image = images[0]
	}

	const manifest = Array.from(files.value).find(
		(file) => file.name == 'imsmanifest.xml'
	)
	if (manifest) {
		readFile(manifest)
	}
}

const readFile = (file) => {
	return new Promise((resolve) => {
		const reader = new FileReader()
		reader.onload = function () {
			resolve(reader.result)
			if (file.name.endsWith('.xml')) parseManifest(reader.result)
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

	if (organization.getElementsByTagName('metadata').length) {
		const metadata = organization.getElementsByTagName('metadata')[0]
		course.description = metadata
			.getElementsByTagName('description')[0]
			.getElementsByTagName('string')[0].textContent
	}

	// Extract course items (SCOs and titles)
	const items = organization.getElementsByTagName('item')
	for (let i = 0; i < items.length; i++) {
		const itemTitle = items[i].getElementsByTagName('title')[0].textContent
	}

	// Extract resources
	const resources = xml.getElementsByTagName('resource')
	formOutline(resources)
	//createCourse()
}

const formOutline = (resources) => {
	const chaptersMap = []
	Array.from(resources).forEach((resource) => {
		const resourceFiles = resource.getElementsByTagName('file')

		Array.from(resourceFiles).forEach(async (file) => {
			const href = file.getAttribute('href')

			const folder = href.split('/')[0]
			if (folder === 'shared') {
				return // Ignore files in the "shared" folder
			}

			if (!chaptersMap.filter((chapter) => chapter.title == folder).length) {
				chaptersMap.push({
					title: folder,
					lessons: [],
				})
			}

			const chapter = chaptersMap.filter(
				(chapter) => chapter.title == folder
			)[0]
			let fileData = Array.from(files.value).find((file) => {
				return file.webkitRelativePath.split('/').slice(-2).join('/') == href
			})
			if (isHtmlFile(href)) {
				const json = await getLessonJSON(fileData, 'html')
				chapter.lessons.push({
					title: href.split('/').pop().replace('.html', ''),
					type: 'html',
					path: href,
					content: json,
				})
			} else if (href.endsWith('.js')) {
				const json = await getLessonJSON(fileData, 'quiz')
				chapter.lessons.push({
					title: `${folder} Quiz`,
					type: 'quiz',
					path: href,
					content: json,
				})
			}
		})
	})
	chapters.value = Array.from(chaptersMap.values())
	console.log('Chapters created from resources:', chapters.value)
}

const newCourse = createResource({
	url: 'lms.lms.api.create_scorm_course',
	makeParams(values) {
		return {
			course: course,
			chapters: chapters.value,
		}
	},
})

const createCourse = () => {
	uploader
		.upload(course.image, {
			private: false,
			folder: 'Home',
			optimize: true,
		})
		.then((data) => {
			course.image = data.file_url
			newCourse.submit(
				{},
				{
					onSuccess(info) {
						router.push({
							name: 'CourseForm',
							params: { courseName: info.name },
						})
					},
					onError(err) {
						showToast(__('Error'), __(err.messages?.[0] || err), 'x')
					},
				}
			)
		})
		.catch((error) => {
			let errorMessage = 'Error Uploading File'
			if (error?._server_messages) {
				errorMessage = JSON.parse(JSON.parse(error._server_messages)[0]).message
			} else if (error?.exc) {
				errorMessage = JSON.parse(error.exc)[0].split('\n').slice(-2, -1)[0]
			}
			console.log(errorMessage)
		})
}

const isImage = (file) => {
	if (file?.startsWith('image')) {
		return true
	}
	return (
		file?.endsWith('jpg') || file?.endsWith('jpeg') || file?.endsWith('png')
	)
}

const isHtmlFile = (file) => {
	return file.endsWith('.html')
}

const convertHTMLToJSON = (htmlContent) => {
	const parser = new DOMParser()
	const doc = parser.parseFromString(htmlContent, 'text/html')
	const blocks = []
	let blockId = 1

	doc.body.childNodes.forEach((node) => {
		if (node.nodeType === 1) {
			switch (node.tagName.toLowerCase()) {
				case 'h1':
				case 'h2':
				case 'h3':
				case 'h4':
				case 'h5':
				case 'h6':
					blocks.push({
						id: `h_${blockId++}`,
						type: 'header',
						data: {
							level: parseInt(node.tagName[1]),
							text: node.textContent.trim(),
						},
					})
					break
				case 'p':
					blocks.push({
						id: `p_${blockId++}`,
						type: 'paragraph',
						data: {
							text: node.textContent.trim(),
						},
					})
					break
				case 'ol':
					const orderedListItems = []
					node.querySelectorAll('li').forEach((listItem) => {
						orderedListItems.push({
							content: listItem.textContent.trim(),
							items: [],
						})
					})
					blocks.push({
						id: `l_${blockId++}`,
						type: 'list',
						data: {
							style: 'ordered',
							items: orderedListItems,
						},
					})
					break
				case 'img':
					let image = node.src.split('/').pop()
					let imageFile = Array.from(files.value).find((file) => {
						return file.webkitRelativePath.split('/').pop() == image
					})

					uploader
						.upload(imageFile, {
							private: false,
							folder: 'Home',
							optimize: true,
						})
						.then((data) => {
							blocks.push({
								id: `i_${blockId++}`,
								type: 'upload',
								data: {
									file_url: data.file_url,
								},
							})
						})
					break
			}
		}
	})

	return {
		time: Date.now(),
		blocks: blocks,
	}
}
// quizContent is a js file with questions in this format
/* test.AddQuestion( new Question ("com.scorm.golfsamples.interactions.etiquette_1",
                                "When another player is attempting a shot, it is best to stand:", 
                                QUESTION_TYPE_CHOICE,
                                new Array("On top of his ball", "Directly in his line of fire", "Out of the player's line of sight"),
                                "Out of the player's line of sight",
                                "obj_etiquette")
                ); */
// We have to read this file and convert it to JSON format
const capturedQuestions = []

const test = {
	AddQuestion: function (question) {
		capturedQuestions.push(question)
	},
}

const QUESTION_TYPE_CHOICE = 'Choices'
const QUESTION_TYPE_TF = 'TrueFalse'
const QUESTION_TYPE_NUMERIC = 'Numeric'

function Question(id, text, type, answers, correctAnswer, objectiveId) {
	this.Id = id
	this.Text = text
	this.Type = type
	this.Answers = answers
	this.CorrectAnswer = correctAnswer
	this.ObjectiveId = objectiveId
}

const convertQuizToJSON = (quizContent) => {
	eval(quizContent)
	return capturedQuestions.map((question, index) => {
		let questionJSON = {
			id: `q_${index + 1}`,
			question: question.Text,
			type: question.Type,
			correctAnswer: question.CorrectAnswer,
			objective: question.ObjectiveId,
		}

		if (question.Type === 'TrueFalse') {
			console.log(questionJSON.question)
			questionJSON.Answers = ['True', 'False']
			question.type = 'Choices'
		}

		if (question.type === 'Choices' && question.Answers?.length) {
			console.log(questionJSON.question)
			questionJSON.options = question.Answers.map((answer) => ({
				option: answer,
				is_correct: answer === question.CorrectAnswer,
			}))
		}

		console.log(questionJSON)
		return questionJSON
	})
}

const getLessonJSON = async (file, type) => {
	try {
		const result = await readFile(file)
		if (type == 'html') return convertHTMLToJSON(result)
		else if (type == 'quiz') {
			return convertQuizToJSON(result)
		}
	} catch (error) {
		console.error('Error reading file:', error)
	}
}
</script>
