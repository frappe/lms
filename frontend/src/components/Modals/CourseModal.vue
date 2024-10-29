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
							<FileText class="size-8 stroke-1.5" />
							<div class="text-sm">
								{{ __('Course Form') }}
							</div>
						</router-link>
					</div>
					<div
						@click="renderScormForm()"
						class="flex flex-col items-center space-y-2 shadow rounded-md cursor-pointer hover:bg-gray-50 w-full p-4"
					>
						<FolderCog class="size-8 stroke-1.5" />
						<div class="text-sm">
							{{ __('SCORM Package') }}
						</div>
					</div>
				</div>
				<div v-else class="border rounded-md text-center py-10">
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
import { ref, reactive } from 'vue'
import { showToast } from '@/utils'
import { useRouter } from 'vue-router'

const router = useRouter()
const show = defineModel()
const title = ref(__('Select a method'))
const scormSelected = ref(false)
const folderInput = ref(null)
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
	title.value = __('Select a SCORM Package')
	setTimeout(() => {
		openFileSelector()
	}, 0)
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

const parseManifest = async(result) => {

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

	// Extract resources

	const resources = xml.getElementsByTagName('resource')

	await formOutline(resources)

	console.log("after outline", chapters.value)

	createCourse()

}

const formOutline = async (resources) => {

	for (const resource of Array.from(resources)) {

	const resourceFiles = resource.getElementsByTagName('file')

	for (const [index, file] of Array.from(resourceFiles).entries()) {

	const href = file.getAttribute('href')

	const folder = href.split('/')[0]

	if (folder === 'shared') {

	return // Ignore files in the "shared" folder

	}

	if (!chapters.value.filter((chapter) => chapter.title == folder).length) {

	chapters.value.push({

	title: folder,

	lessons: [],

	})

	}

	const chapter = chapters.value.filter(

	(chapter) => chapter.title == folder

	)[0]

	let fileData = Array.from(files.value).find((file) => {

	return file.webkitRelativePath.split('/').slice(-2).join('/') == href

	})

	if (fileData) {

	let lessonContent = null

	let lessonType = ''

	if (isHtmlFile(href)) {

	lessonContent = await getLessonJSON(fileData, 'html')

	lessonType = 'html'

	} else if (href.endsWith('.js')) {

	lessonContent = await getLessonJSON(fileData, 'quiz')

	lessonType = 'quiz'

	}

	if (lessonContent) {

	chapter.lessons.push({

	title: lessonType == "html" ? href.split('/').pop().replace(/\.(html|js)/, '') : `${folder} Quiz`,

	type: lessonType,

	path: href,

	content: lessonContent,

	index,

	})

	console.log('Lesson created:', chapter.lessons)

	}

	}

	}

	}

	/* for (const chapter of chaptersMap) {

	chapter.lessons.sort((a, b) => a.index - b.index);

	} */

	// Assign chapters to reactive chapters array

	console.log('Chapters created from resources:', chapters.value)

}

const newCourse = createResource({

	url: 'lms.lms.api.create_scorm_course',

	makeParams(values) {

	console.log("params", chapters.value)

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

const convertHTMLToJSON = async (htmlContent) => {

	const parser = new DOMParser();

	const doc = parser.parseFromString(htmlContent, 'text/html');

	const blocks = [];

	let blockId = 1;

	// Iterate through all nodes in the body in the correct order

	for (let node of doc.body.childNodes) {

	if (node.nodeType === 1) {  // Element node

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

	});

	break;

	case 'p':

	blocks.push({

	id: `p_${blockId++}`,

	type: 'paragraph',

	data: {

	text: node.textContent.trim(),

	},

	});

	break;

	case 'ol':

	const orderedListItems = [];

	node.querySelectorAll('li').forEach((listItem) => {

	orderedListItems.push({

	content: listItem.textContent.trim(),

	items: [],

	});

	});

	blocks.push({

	id: `l_${blockId++}`,

	type: 'list',

	data: {

	style: 'ordered',

	items: orderedListItems,

	},

	});

	break;

	case 'img':

	let image = node.src.split('/').pop();

	let imageFile = Array.from(files.value).find((file) => {

	return file.webkitRelativePath.split('/').pop() == image;

	});

	// Await the upload to maintain the correct order

	const data = await uploader.upload(imageFile, {

	private: false,

	folder: 'Home',

	optimize: true,

	});

	// Push the image block after upload completes

	blocks.push({

	id: `i_${blockId++}`,

	type: 'upload',

	data: {

	file_url: data.file_url,

	file_type: data.file_type,

	},

	});

	break;

	}

	}

	}

	return {

	time: Date.now(),

	blocks: blocks,

	};

	};

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

	question.Answers = [true, false]

	questionJSON.type = 'Choices'

	}

	if (question.Type === "Numeric") {

	question.Answers = [question.CorrectAnswer]

	// Adding 2 random wrong answers

	for (let key in Array.from({ length: 2 })) {

	let randomOption = question.correctAnswer

	while (randomOption == question.CorrectAnswer || question.Answers.includes(randomOption)) {

	randomOption = question.CorrectAnswer + Math.floor(Math.random() * 10)

	}

	question.Answers.push(randomOption)

	}

	// Shuffling the answers

	question.Answers.sort(() => Math.random() - 0.5)

	questionJSON.type = "Choices"

	}

	if (questionJSON.type === 'Choices' && question.Answers?.length) {

	questionJSON.options = question.Answers.map((answer) => ({

	option: answer,

	is_correct: answer === question.CorrectAnswer,

	}))

	}

	return questionJSON

	})

}

const getLessonJSON = async (file, type) => {

	try {

	const result = await readFile(file)

	if (type == 'html') {

	return await convertHTMLToJSON(result)

	} else if (type == 'quiz') {

	return convertQuizToJSON(result)

	}

	} catch (error) {

	console.error('Error reading file:', error)

	}

}

</script>
