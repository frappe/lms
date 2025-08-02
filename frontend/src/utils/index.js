import { call, toast } from 'frappe-ui'
import { useTimeAgo } from '@vueuse/core'
import { Quiz } from '@/utils/quiz'
import { Program } from '@/utils/program'
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
	const dummyDate = new Date(0, 0, 0, hour, minute)
	const formattedTime = new Intl.DateTimeFormat('en-US', {
		hour: 'numeric',
		minute: 'numeric',
		hour12: true,
	}).format(dummyDate)
	return formattedTime
}

export const formatSeconds = (time) => {
	const minutes = Math.floor(time / 60)
	const seconds = Math.floor(time % 60)
	return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`
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
		list: {
			class: NestedList,
			inlineToolbar: true,
			config: {
				defaultStyle: 'ordered',
			},
		},
		table: {
			class: Table,
			inlineToolbar: true,
		},
		quiz: Quiz,
		assignment: Assignment,
		program: Program,
		upload: Upload,
		markdown: {
			class: Markdown,
			inlineToolbar: true,
		},
		image: SimpleImage,
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
					bunnyStream: {
						regex: /https:\/\/(?:iframe\.mediadelivery\.net|video\.bunnycdn\.com)\/play\/([a-zA-Z0-9]+\/[a-zA-Z0-9-]+)/,
						embedUrl:
							'https://iframe.mediadelivery.net/embed/<%= remote_id %>',
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

export const validateFile = (file, showToast = true) => {
	if (!file.type.startsWith('image/')) {
		const errorMessage = __('Only image file is allowed.')
		if (showToast) {
			toast.error(errorMessage)
		}
		return errorMessage
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

export const enablePlyr = async () => {
	await wait(500)

	const players = []
	const videoElements = document.getElementsByClassName('video-player')

	if (videoElements.length === 0) return players

	Array.from(videoElements).forEach((video) => {
		setupPlyrForVideo(video, players)
	})

	return players
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const setupPlyrForVideo = (video, players) => {
	const src = video.getAttribute('src')

	if (src) {
		const videoID = extractYouTubeId(src)
		video.setAttribute('data-plyr-embed-id', videoID)
	}

	let controls = [
		'play-large',
		'play',
		'progress',
		'current-time',
		'mute',
		'volume',
		'fullscreen',
	]

	const player = new Plyr(video, {
		youtube: { noCookie: true },
		controls: controls,
		listeners: {
			seek: function customSeekBehavior(e) {
				const current_time = player.currentTime
				const newTime = getTargetTime(player, e)
				if (
					useSettings().preventSkippingVideos.data &&
					parseFloat(newTime) > current_time
				) {
					e.preventDefault()
					player.currentTime = current_time
					return false
				}
			},
		},
	})

	players.push(player)
}

const getTargetTime = (plyr, input) => {
	if (
		typeof input === 'object' &&
		(input.type === 'input' || input.type === 'change')
	) {
		return (input.target.value / input.target.max) * plyr.duration
	} else {
		return Number(input)
	}
}

const extractYouTubeId = (url) => {
	try {
		const parsedUrl = new URL(url)
		return (
			parsedUrl.searchParams.get('v') ||
			parsedUrl.pathname.split('/').pop()
		)
	} catch {
		return url.split('/').pop()
	}
}

export const openSettings = (category, close = null) => {
	const settingsStore = useSettings()
	if (close) {
		close()
	}
	settingsStore.activeTab = category
	settingsStore.isSettingsOpen = true
}

export const cleanError = (message) => {
	const cleanMessage = message.replace(/<[^>]+>/g, (match) => {
		return match.replace(/<\/?[^>]+(>|$)/g, '')
	})
	return cleanMessage
		.replace(/&nbsp;/g, ' ')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&amp;/g, '&')
		.replace(/&#x60;/g, '`')
		.replace(/&#x3D;/g, '=')
		.replace(/&#x2F;/g, '/')
		.replace(/&#x2C;/g, ',')
		.replace(/&#x3B;/g, ';')
		.replace(/&#x3A;/g, ':')
}

export const getMetaInfo = (type, route, meta) => {
	call('lms.lms.api.get_meta_info', {
		type: type,
		route: route,
	}).then((data) => {
		if (data.length) {
			data.forEach((row) => {
				if (row.key == 'description') {
					meta.description = row.value
				} else if (row.key == 'keywords') {
					meta.keywords = row.value
				}
			})
		}
	})
}

export const updateMetaInfo = (type, route, meta) => {
	call('lms.lms.api.update_meta_info', {
		type: type,
		route: route,
		meta_tags: [
			{ key: 'description', value: meta.description },
			{ key: 'keywords', value: meta.keywords },
		],
	}).catch((error) => {
		toast.error(__('Failed to update meta tags {0}').format(error))
		console.error(error)
	})
}

export const formatTimestamp = (seconds) => {
	const date = new Date(seconds * 1000)
	const minutes = String(date.getUTCMinutes()).padStart(2, '0')
	const secs = String(date.getUTCSeconds()).padStart(2, '0')
	return `${minutes}:${secs}`
}

export const convertToMinutes = (seconds) => {
	const minutes = Math.floor(seconds / 60)
	const remainingSeconds = Math.round(seconds % 60)
	return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}
