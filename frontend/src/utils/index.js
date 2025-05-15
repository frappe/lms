import { useTimeAgo } from '@vueuse/core'
import { Quiz } from '@/utils/quiz'
import { Assignment } from '@/utils/assignment'
import { Upload } from '@/utils/upload'
import { Markdown } from '@/utils/markdownParser'
import { useSettings } from '@/stores/settings'
import { usersStore } from '@/stores/user'
import Header from '@editorjs/header'
import Paragraph from '@editorjs/paragraph'
import { CodeBox } from '@/utils/code'
import NestedList from '@editorjs/nested-list'
import InlineCode from '@editorjs/inline-code'
import { watch } from 'vue'
import dayjs from '@/utils/dayjs'
import Embed from '@editorjs/embed'
import SimpleImage from '@editorjs/simple-image'
import Table from '@editorjs/table'
import Plyr from 'plyr'
import 'plyr/dist/plyr.css'

const readOnlyMode = window.read_only_mode

export function timeAgo(date) {
	return useTimeAgo(date).value
}

export function formatTime(timeString) {
	if (!timeString) return ''
	const [hour, minute] = timeString.split(':').map(Number)

	// Create a Date object with dummy values for day, month, and year
	const dummyDate = new Date(0, 0, 0, hour, minute)

	// Use Intl.DateTimeFormat to format the time in 12-hour format
	const formattedTime = new Intl.DateTimeFormat('en-US', {
		hour: 'numeric',
		minute: 'numeric',
		hour12: true,
	}).format(dummyDate)

	return formattedTime
}

export function formatNumber(number) {
	return number.toLocaleString('en-IN', {
		maximumFractionDigits: 0,
	})
}

export function formatNumberIntoCurrency(number, currency) {
	if (number) {
		return number.toLocaleString('en-IN', {
			maximumFractionDigits: 0,
			style: 'currency',
			currency: currency,
		})
	}
	return ''
}

// create a function that formats numbers in thousands to k

export function formatAmount(amount) {
	if (amount > 999) {
		return (amount / 1000).toFixed(1) + 'k'
	}
	return amount
}

export function convertToTitleCase(str) {
	if (!str) {
		return ''
	}

	return str
		.toLowerCase()
		.split(' ')
		.map(function (word) {
			return word.charAt(0).toUpperCase().concat(word.substr(1))
		})
		.join(' ')
}
export function getFileSize(file_size) {
	let value = parseInt(file_size)
	if (value > 1048576) {
		return (value / 1048576).toFixed(2) + 'M'
	} else if (value > 1024) {
		return (value / 1024).toFixed(2) + 'K'
	}
	return value
}

export function getImgDimensions(imgSrc) {
	return new Promise((resolve) => {
		let img = new Image()
		img.onload = function () {
			let { width, height } = img
			resolve({ width, height, ratio: width / height })
		}
		img.src = imgSrc
	})
}

export function updateDocumentTitle(meta) {
	watch(
		() => meta,
		(meta) => {
			if (!meta.value.title) return
			if (meta.value.title && meta.value.subtitle) {
				document.title = `${meta.value.title} | ${meta.value.subtitle}`
				return
			}
			if (meta.value.title) {
				document.title = `${meta.value.title}`
				return
			}
		},
		{ immediate: true, deep: true }
	)
}

export function htmlToText(html) {
	const div = document.createElement('div')
	div.innerHTML = html
	return div.textContent || div.innerText || ''
}

export function getEditorTools() {
	return {
		header: {
			class: Header,
			config: {
				placeholder: 'Header',
			},
		},
		quiz: Quiz,
		assignment: Assignment,
		upload: Upload,
		markdown: {
			class: Markdown,
			inlineToolbar: true,
		},
		image: SimpleImage,
		table: {
			class: Table,
			inlineToolbar: true,
		},
		paragraph: {
			class: Paragraph,
			inlineToolbar: true,
			config: {
				preserveBlank: true,
			},
		},
		codeBox: {
			class: CodeBox,
			config: {
				useDefaultTheme: 'dark',
			},
		},
		list: {
			class: NestedList,
			inlineToolbar: true,
			config: {
				defaultStyle: 'ordered',
			},
		},
		inlineCode: {
			class: InlineCode,
			shortcut: 'CMD+SHIFT+M',
		},
		embed: {
			class: Embed,
			inlineToolbar: false,
			config: {
				services: {
					youtube: {
						regex: /(?:https?:\/\/)?(?:www\.)?(?:(?:youtu\.be\/)|(?:youtube\.com)\/(?:v\/|u\/\w\/|embed\/|watch))(?:(?:\?v=)?([^#&?=]*))?((?:[?&]\w*=\w*)*)/,
						embedUrl: '<%= remote_id %>',
						/* 'https://www.youtube.com/embed/<%= remote_id %>?origin=https://plyr.io&amp;iv_load_policy=3&amp;modestbranding=1&amp;playsinline=1&amp;showinfo=0&amp;rel=0&amp;enablejsapi=1' */
						html: `<div class="video-player" data-plyr-provider="youtube"></div>`,
						id: ([id]) => id,
					},
					vimeo: {
						regex: /(?:http[s]?:\/\/)?(?:www\.)?vimeo\.com\/(\d+)/,
						embedUrl: '<%= remote_id %>',
						html: `<div class="video-player" data-plyr-provider="vimeo"></div>`,
						id: ([id]) => id,
					},
					cloudflareStream: {
						regex: /https:\/\/customer-[a-z0-9]+\.cloudflarestream\.com\/([a-f0-9]{32})\/watch/,
						embedUrl:
							'https://iframe.videodelivery.net/<%= remote_id %>',
						html: `<iframe style="width:100%; height: ${
							window.innerWidth < 640 ? '15rem' : '30rem'
						};" frameborder="0" allowfullscreen></iframe>`,
					},
					codepen: true,
					aparat: {
						regex: /(?:http[s]?:\/\/)?(?:www.)?aparat\.com\/v\/([^\/\?\&]+)\/?/,
						embedUrl:
							'https://www.aparat.com/video/video/embed/videohash/<%= remote_id %>/vt/frame',
						html: `<iframe style="margin: 0 auto; width: 100%; height: ${
							window.innerWidth < 640 ? '15rem' : '30rem'
						};" frameborder="0" scrolling="no" allowtransparency="true"></iframe>`,
					},
					github: true,
					slides: {
						regex: /https:\/\/docs\.google\.com\/presentation\/d\/([A-Za-z0-9_-]+)\/pub/,
						embedUrl:
							'https://docs.google.com/presentation/d/<%= remote_id %>/embed',
						html: `<iframe style='width: 100%; height: ${
							window.innerWidth < 640 ? '15rem' : '30rem'
						}; border: 1px solid #D3D3D3; border-radius: 12px; margin: 1rem 0' frameborder='0' allowfullscreen='true'></iframe>`,
					},
					drive: {
						regex: /https:\/\/drive\.google\.com\/file\/d\/([A-Za-z0-9_-]+)\/view(\?.+)?/,
						embedUrl:
							'https://drive.google.com/file/d/<%= remote_id %>/preview',
						html: `<iframe style='width: 100%; height: ${
							window.innerWidth < 640 ? '15rem' : '30rem'
						}; border: 1px solid #D3D3D3; border-radius: 12px;' frameborder='0' allowfullscreen='true'></iframe>`,
					},
					docsPublic: {
						regex: /https:\/\/docs\.google\.com\/document\/d\/([A-Za-z0-9_-]+)\/edit(\?.+)?/,
						embedUrl:
							'https://docs.google.com/document/d/<%= remote_id %>/preview',
						html: "<iframe style='width: 100%; height: 40rem; border: 1px solid #D3D3D3; border-radius: 12px;' frameborder='0' allowfullscreen='true'></iframe>",
					},
					sheetsPublic: {
						regex: /https:\/\/docs\.google\.com\/spreadsheets\/d\/([A-Za-z0-9_-]+)\/edit(\?.+)?/,
						embedUrl:
							'https://docs.google.com/spreadsheets/d/<%= remote_id %>/preview',
						html: "<iframe style='width: 100%; height: 40rem; border: 1px solid #D3D3D3; border-radius: 12px;' frameborder='0' allowfullscreen='true'></iframe>",
					},
					slidesPublic: {
						regex: /https:\/\/docs\.google\.com\/presentation\/d\/([A-Za-z0-9_-]+)\/edit(\?.+)?/,
						embedUrl:
							'https://docs.google.com/presentation/d/<%= remote_id %>/embed',
						html: "<iframe style='width: 100%; height: 30rem; border: 1px solid #D3D3D3; border-radius: 12px; margin: 1rem 0;' frameborder='0' allowfullscreen='true'></iframe>",
					},
					codesandbox: {
						regex: /^https:\/\/codesandbox\.io\/(?:embed\/)?([A-Za-z0-9_-]+)(?:\?[^\/]*)?$/,
						embedUrl:
							'https://codesandbox.io/embed/<%= remote_id %>?view=editor+%2B+preview&module=%2Findex.html',
						html: "<iframe style='width: 100%; height: 500px; border: 0; border-radius: 4px; overflow: hidden;' sandbox='allow-mods allow-forms allow-popups allow-scripts allow-same-origin' frameborder='0' allowfullscreen='true'></iframe>",
					},
				},
			},
		},
	}
}

export function getTimezones() {
	return [
		'Pacific/Midway',
		'Pacific/Pago_Pago',
		'Pacific/Honolulu',
		'America/Anchorage',
		'America/Vancouver',
		'America/Los_Angeles',
		'America/Tijuana',
		'America/Edmonton',
		'America/Denver',
		'America/Phoenix',
		'America/Mazatlan',
		'America/Winnipeg',
		'America/Regina',
		'America/Chicago',
		'America/Mexico_City',
		'America/Guatemala',
		'America/El_Salvador',
		'America/Managua',
		'America/Costa_Rica',
		'America/Montreal',
		'America/New_York',
		'America/Indianapolis',
		'America/Panama',
		'America/Bogota',
		'America/Lima',
		'America/Halifax',
		'America/Puerto_Rico',
		'America/Caracas',
		'America/Santiago',
		'America/St_Johns',
		'America/Montevideo',
		'America/Araguaina',
		'America/Argentina/Buenos_Aires',
		'America/Godthab',
		'America/Sao_Paulo',
		'Atlantic/Azores',
		'Canada/Atlantic',
		'Atlantic/Cape_Verde',
		'UTC',
		'Etc/Greenwich',
		'Europe/Belgrade',
		'CET',
		'Atlantic/Reykjavik',
		'Europe/Dublin',
		'Europe/London',
		'Europe/Lisbon',
		'Africa/Casablanca',
		'Africa/Nouakchott',
		'Europe/Oslo',
		'Europe/Copenhagen',
		'Europe/Brussels',
		'Europe/Berlin',
		'Europe/Helsinki',
		'Europe/Amsterdam',
		'Europe/Rome',
		'Europe/Stockholm',
		'Europe/Vienna',
		'Europe/Luxembourg',
		'Europe/Paris',
		'Europe/Zurich',
		'Europe/Madrid',
		'Africa/Bangui',
		'Africa/Algiers',
		'Africa/Tunis',
		'Africa/Harare',
		'Africa/Nairobi',
		'Europe/Warsaw',
		'Europe/Prague',
		'Europe/Budapest',
		'Europe/Sofia',
		'Europe/Istanbul',
		'Europe/Athens',
		'Europe/Bucharest',
		'Asia/Nicosia',
		'Asia/Beirut',
		'Asia/Damascus',
		'Asia/Jerusalem',
		'Asia/Amman',
		'Africa/Tripoli',
		'Africa/Cairo',
		'Africa/Johannesburg',
		'Europe/Moscow',
		'Asia/Baghdad',
		'Asia/Kuwait',
		'Asia/Riyadh',
		'Asia/Bahrain',
		'Asia/Qatar',
		'Asia/Aden',
		'Asia/Tehran',
		'Africa/Khartoum',
		'Africa/Djibouti',
		'Africa/Mogadishu',
		'Asia/Dubai',
		'Asia/Muscat',
		'Asia/Baku',
		'Asia/Kabul',
		'Asia/Yekaterinburg',
		'Asia/Tashkent',
		'Asia/Calcutta',
		'Asia/Kathmandu',
		'Asia/Novosibirsk',
		'Asia/Almaty',
		'Asia/Dacca',
		'Asia/Krasnoyarsk',
		'Asia/Dhaka',
		'Asia/Bangkok',
		'Asia/Saigon',
		'Asia/Jakarta',
		'Asia/Irkutsk',
		'Asia/Shanghai',
		'Asia/Hong_Kong',
		'Asia/Taipei',
		'Asia/Kuala_Lumpur',
		'Asia/Singapore',
		'Australia/Perth',
		'Asia/Yakutsk',
		'Asia/Seoul',
		'Asia/Tokyo',
		'Australia/Darwin',
		'Australia/Adelaide',
		'Asia/Vladivostok',
		'Pacific/Port_Moresby',
		'Australia/Brisbane',
		'Australia/Sydney',
		'Australia/Hobart',
		'Asia/Magadan',
		'SST',
		'Pacific/Noumea',
		'Asia/Kamchatka',
		'Pacific/Fiji',
		'Pacific/Auckland',
		'Asia/Kolkata',
		'Europe/Kiev',
		'America/Tegucigalpa',
		'Pacific/Apia',
	]
}

export function getUserTimezone() {
	try {
		const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
		const supportedTimezones = getTimezones()

		if (supportedTimezones.includes(timezone)) {
			return timezone // e.g., 'Asia/Calcutta', 'America/New_York', etc.
		} else {
			throw Error('unsupported timezone')
		}
	} catch (error) {
		console.error('Error getting timezone:', error)
		return null
	}
}

export function getSidebarLinks() {
	return [
		{
			label: 'Courses',
			icon: 'BookOpen',
			to: 'Courses',
			activeFor: [
				'Courses',
				'CourseDetail',
				'Lesson',
				'CourseForm',
				'LessonForm',
			],
		},
		{
			label: 'Batches',
			icon: 'Users',
			to: 'Batches',
			activeFor: ['Batches', 'BatchDetail', 'Batch', 'BatchForm'],
		},
		{
			label: 'Certified Members',
			icon: 'GraduationCap',
			to: 'CertifiedParticipants',
			activeFor: ['CertifiedParticipants'],
		},
		{
			label: 'Jobs',
			icon: 'Briefcase',
			to: 'Jobs',
			activeFor: ['Jobs', 'JobDetail'],
		},
		{
			label: 'Statistics',
			icon: 'TrendingUp',
			to: 'Statistics',
			activeFor: ['Statistics'],
		},
	]
}

export function getFormattedDateRange(
	startDate,
	endDate,
	format = 'DD MMM YYYY'
) {
	if (startDate === endDate) {
		return dayjs(startDate).format(format)
	}
	return `${dayjs(startDate).format(format)} - ${dayjs(endDate).format(
		format
	)}`
}

export function getLineStartPosition(string, position) {
	const charLength = 1
	let char = ''

	while (char !== '\n' && position > 0) {
		position = position - charLength
		char = string.substr(position, charLength)
	}

	if (char === '\n') {
		position += 1
	}

	return position
}

export function singularize(word) {
	const endings = {
		ves: 'fe',
		ies: 'y',
		i: 'us',
		zes: 'ze',
		ses: 's',
		es: 'e',
		s: '',
	}
	return word.replace(
		new RegExp(`(${Object.keys(endings).join('|')})$`),
		(r) => endings[r]
	)
}

export const validateFile = (file) => {
	let extension = file.name.split('.').pop().toLowerCase()
	if (!['jpg', 'jpeg', 'png', 'webp'].includes(extension)) {
		return __('Only image file is allowed.')
	}
}

export const escapeHTML = (text) => {
	if (!text) return ''
	let escape_html_mapping = {
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&#39;',
		'`': '&#x60;',
		'=': '&#x3D;',
	}

	return String(text).replace(
		/[&<>"'`=]/g,
		(char) => escape_html_mapping[char] || char
	)
}

export const canCreateCourse = () => {
	const { userResource } = usersStore()
	return (
		!readOnlyMode &&
		(userResource.data?.is_instructor || userResource.data?.is_moderator)
	)
}

export const enablePlyr = () => {
	setTimeout(() => {
		const videoElement = document.getElementsByClassName('video-player')
		if (videoElement.length === 0) return

		Array.from(videoElement).forEach((video) => {
			const src = video.getAttribute('src')
			if (src) {
				let videoID = src.split('/').pop()
				video.setAttribute('data-plyr-embed-id', videoID)
			}
			new Plyr(video, {
				youtube: {
					noCookie: true,
				},
				controls: [
					'play-large',
					'play',
					'progress',
					'current-time',
					'mute',
					'volume',
					'fullscreen',
				],
			})
		}, 500)
	})
}

export const openSettings = (category, close) => {
	const settingsStore = useSettings()
	close()
	settingsStore.activeTab = category
	settingsStore.isSettingsOpen = true
}
