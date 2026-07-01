import LogoFrappeMail from '@/assets/images/frappe-mail.svg'
import LogoGmail from '@/assets/images/gmail.png'
import LogoOutlook from '@/assets/images/outlook.png'
import LogoSendgrid from '@/assets/images/sendgrid.png'
import LogoSparkpost from '@/assets/images/sparkpost.webp'
import LogoYahoo from '@/assets/images/yahoo.png'
import LogoYandex from '@/assets/images/yandex.png'
import type { EmailService, RenderField } from '@/types/email'
import { validateEmail } from '@/utils'

declare global {
	interface Window {
		__?: (text: string) => string
	}
}

// `__` is a global set by the translation plugin at app init, but this module's
// field arrays are built at import time — which can run before that. Resolve
// lazily and fall back to the raw string so importing this module never throws.
const __ = (txt: string): string => (window.__ ? window.__(txt) : txt)

type EmailAccountFormState = {
	email_account_name?: string
	email_id?: string
	service?: string
	password?: string
	api_key?: string
	api_secret?: string
	frappe_mail_site?: string
}

const fixedFields: RenderField[] = [
	{
		label: __('Account name'),
		name: 'email_account_name',
		type: 'text',
		placeholder: __('Support / Sales'),
		required: true,
	},
	{
		label: __('Email ID'),
		name: 'email_id',
		type: 'email',
		placeholder: __('johndoe@example.com'),
		required: true,
	},
]

export const incomingOutgoingFields: RenderField[] = [
	{
		label: __('Enable Incoming'),
		name: 'enable_incoming',
		type: 'checkbox',
		description: __('If enabled, emails will be pulled from this account.'),
	},
	{
		label: __('Enable Outgoing'),
		name: 'enable_outgoing',
		type: 'checkbox',
		description: __(
			'If enabled, outgoing emails can be sent from this account.',
		),
	},
	{
		label: __('Default Incoming'),
		name: 'default_incoming',
		type: 'checkbox',
		description: __(
			'If enabled, all replies to your company (eg: replies@yourcompany.com) will come to this account. Note: Only one account can be default incoming.',
		),
	},
	{
		label: __('Default Outgoing'),
		name: 'default_outgoing',
		type: 'checkbox',
		description: __(
			'If enabled, all outgoing emails will be sent from this account. Note: Only one account can be default outgoing.',
		),
	},
]

export const popularProviderFields = [
	...fixedFields,
	{
		label: __('Password'),
		name: 'password',
		type: 'password',
		placeholder: '********',
		required: true,
	},
]

export const frappeMailFields = [
	...fixedFields,
	{
		label: __('Frappe Mail site'),
		name: 'frappe_mail_site',
		type: 'text',
		placeholder: 'https://frappemail.com',
		required: true,
	},
	{
		label: __('API Key'),
		name: 'api_key',
		type: 'text',
		placeholder: '********',
		required: true,
	},
	{
		label: __('API Secret'),
		name: 'api_secret',
		type: 'password',
		placeholder: '********',
		required: true,
	},
]

// Names match the Email Account `service` field options exactly so the backend
// can map each to its host/port presets.
export const services: EmailService[] = [
	{
		name: 'GMail',
		icon: LogoGmail,
		info: __(`Setting up GMail requires you to enable two factor authentication
		  and app specific passwords. Read more`),
		link: 'https://support.google.com/accounts/answer/185833',
		custom: false,
	},
	{
		name: 'Outlook.com',
		icon: LogoOutlook,
		info: __(`Setting up Outlook requires you to enable two factor authentication
		  and app specific passwords. Read more`),
		link: 'https://support.microsoft.com/en-us/account-billing/how-to-get-and-use-app-passwords-5896ed9b-4263-e681-128a-a6f2979a7944',
		custom: false,
	},
	{
		name: 'Sendgrid',
		icon: LogoSendgrid,
		info: __(`Setting up Sendgrid requires you to enable two factor authentication
		  and app specific passwords. Read more`),
		link: 'https://sendgrid.com/docs/ui/account-and-settings/two-factor-authentication/',
		custom: false,
	},
	{
		name: 'SparkPost',
		icon: LogoSparkpost,
		info: __(`Setting up SparkPost requires you to enable two factor authentication
		  and app specific passwords. Read more`),
		link: 'https://support.sparkpost.com/docs/my-account-and-profile/enabling-two-factor-authentication',
		custom: false,
	},
	{
		name: 'Yahoo Mail',
		icon: LogoYahoo,
		info: __(`Setting up Yahoo requires you to enable two factor authentication
		  and app specific passwords. Read more`),
		link: 'https://help.yahoo.com/kb/SLN15241.html',
		custom: false,
	},
	{
		name: 'Yandex.Mail',
		icon: LogoYandex,
		info: __(`Setting up Yandex requires you to enable two factor authentication
		  and app specific passwords. Read more`),
		link: 'https://yandex.com/support/id/authorization/app-passwords.html',
		custom: false,
	},
	{
		name: 'Frappe Mail',
		icon: LogoFrappeMail,
		info: __(
			`Setting up Frappe Mail requires you to have an API key and API Secret of your email account. Read more`,
		),
		link: 'https://github.com/frappe/mail',
		custom: true,
	},
]

export const emailIcon: Record<string, string> = {
	GMail: LogoGmail,
	'Outlook.com': LogoOutlook,
	Sendgrid: LogoSendgrid,
	SparkPost: LogoSparkpost,
	'Yahoo Mail': LogoYahoo,
	'Yandex.Mail': LogoYandex,
	'Frappe Mail': LogoFrappeMail,
}

export function validateInputs(
	state: EmailAccountFormState,
	service: string,
	allowMissingPassword = false,
) {
	if (!state.email_account_name) {
		return __('Account name is required')
	}
	if (!state.email_id) {
		return __('Email ID is required')
	}
	if (!validateEmail(state.email_id)) {
		return __('Invalid email ID')
	}
	if (service === 'Frappe Mail') {
		if (!state.api_key) {
			return __('API Key is required')
		}
		if (!state.api_secret) {
			return __('API Secret is required')
		}
		return ''
	}
	if (!state.password && !allowMissingPassword) {
		return __('Password is required')
	}
	return ''
}
