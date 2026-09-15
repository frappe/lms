import { call, toast } from 'frappe-ui'
import { defineAsyncComponent, markRaw } from 'vue'
// @ts-expect-error utils/dialogs.js is still plain JS, so it has no declarations
import { createDialog } from '@/utils/dialogs'
import { reloadSettingsLists } from '@/composables/useSettingsListResource'
import { cleanError, validateEmail } from '@/utils'
import LogoFrappeMail from '@/assets/images/frappe-mail.svg'
import LogoGmail from '@/assets/images/gmail.png'
import LogoOutlook from '@/assets/images/outlook.png'
import LogoSendgrid from '@/assets/images/sendgrid.png'
import LogoSparkpost from '@/assets/images/sparkpost.webp'
import LogoYahoo from '@/assets/images/yahoo.png'
import LogoYandex from '@/assets/images/yandex.png'
import type {
	FieldsSection,
	ListPage,
	SettingsField,
} from '@/types/settingsSchema'
import type {
	EmailService,
	RenderField,
	SettingsListColumn,
	SettingsListRow,
} from '@/types'

/**
 * Email accounts, as data — everything except the provider picker.
 *
 * The picker is why this panel keeps a component at all. It comes before any
 * field, it decides which fields there are, and until it has been answered
 * there is nothing to draw. What follows it is ordinary: the field sets below
 * are what the form renders from, and the two payload builders are what the
 * create and update paths send.
 *
 * Every translated string is produced inside a function or a getter — `__` is
 * installed on window only after the settings tree has finished importing.
 */

declare global {
	interface Window {
		__?: (text: string) => string
	}
}

// The field arrays below are built at import time, which can run before the
// translation plugin installs `__`. Resolve lazily and fall back to the raw
// string so importing this module never throws.
const __ = (txt: string): string => (window.__ ? window.__(txt) : txt)

export const DOCTYPE = 'Email Account'

/**
 * The endpoints this page reads and writes through, rather than the generic
 * `frappe.client.*` calls it used to.
 *
 * Core Email Account grants a DocPerm to System Manager and to Inbox User and
 * to nobody else, and settings is Moderator-gated — so every one of those
 * generic calls was refused and the page rendered empty over a table that was
 * not. Each of these checks `Moderator` itself, the same shape as Settings >
 * Users, which `lms.lms.api.get_members` fronts for the same reason.
 */
const METHOD = {
	list: 'lms.lms.email_account.get_email_accounts',
	get: 'lms.lms.email_account.get_email_account',
	create: 'lms.lms.email_account.create_email_account',
	update: 'lms.lms.email_account.update_email_account',
	rename: 'lms.lms.email_account.rename_email_account',
	remove: 'lms.lms.email_account.delete_email_account',
	setDefault: 'lms.lms.email_account.set_default_email_account',
} as const

export { METHOD as EMAIL_ACCOUNT_METHODS }

/**
 * The page size the list arrives in. Load More is offered while a page comes
 * back full, so this has to be what the endpoint pages at —
 * `EMAIL_ACCOUNTS_PAGE_LENGTH` in lms/lms/email_account.py, which is this same
 * 13.
 */
export const EMAIL_ACCOUNTS_PAGE_LENGTH = 13

/** The one service with an API key instead of a password. */
export const FRAPPE_MAIL = 'Frappe Mail'

/**
 * A server with no preset, whose host, port and encryption the user types.
 *
 * Email Account's own `service` Select has no such option — a hand-entered
 * server is stored with no service at all — so this name lives on the client
 * and on the endpoint, and the blank is what reaches the document.
 */
export const CUSTOM_SERVICE = 'Custom'

/**
 * What the endpoints hand back. `name` is the id; it equals the account name.
 *
 * The three credentials are absent, and the server's own allowlist is what
 * enforces that: `password` and `api_secret` are Password fields whose column
 * holds a mask the length of the secret, and `api_key` is a credential stored
 * in the clear. An existing account's credential is only ever replaced here,
 * never shown, so the form has no use for any of them.
 */
export const ACCOUNT_FIELDS = [
	'name',
	'email_account_name',
	'email_id',
	'service',
	'frappe_mail_site',
	'enable_incoming',
	'enable_outgoing',
	'default_incoming',
	'default_outgoing',
	'email_server',
	'incoming_port',
	'smtp_server',
	'smtp_port',
	'use_imap',
	'use_ssl',
	'use_ssl_for_outgoing',
	'login_id',
	'login_id_is_different',
]

export interface EmailAccountState {
	email_account_name: string
	email_id: string
	service: string
	enable_incoming: boolean
	enable_outgoing: boolean
	default_incoming: boolean
	default_outgoing: boolean
	password?: string | null
	api_key?: string | null
	api_secret?: string | null
	frappe_mail_site?: string
	email_server?: string
	incoming_port?: string | number | null
	smtp_server?: string
	smtp_port?: string | number | null
	use_imap?: boolean
	use_ssl?: boolean
	use_ssl_for_outgoing?: boolean
	login?: string
	[key: string]: unknown
}

const fixedFields: RenderField[] = [
	{
		label: __('Account name'),
		name: 'email_account_name',
		type: 'text',
		placeholder: __('Support / Sales'),
		required: true,
		fullWidth: true,
	},
	{
		label: __('Email ID'),
		name: 'email_id',
		type: 'email',
		placeholder: __('johndoe@example.com'),
		required: true,
		fullWidth: true,
	},
]

// Default Incoming/Default Outgoing are set from Communication > General now,
// not per account -- kept off this list so the form has no second, staler way
// to write the same site-wide singleton (see commonPayload below).
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
			'If enabled, outgoing emails can be sent from this account.'
		),
	},
]

export const popularProviderFields: RenderField[] = [
	...fixedFields,
	{
		label: __('Password'),
		name: 'password',
		type: 'password',
		placeholder: '********',
		required: true,
		fullWidth: true,
	},
]

export const frappeMailFields: RenderField[] = [
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

/**
 * The hosts and ports a preset would otherwise have supplied.
 *
 * Ports are `text` rather than a number control on purpose: they reach the
 * endpoint as strings either way, and a spinner on a value nobody increments
 * one at a time is a control that invites the wrong gesture.
 */
export const customServerFields: RenderField[] = [
	{
		label: __('Incoming server'),
		name: 'email_server',
		type: 'text',
		placeholder: 'imap.yourcompany.com',
	},
	{
		label: __('Incoming port'),
		name: 'incoming_port',
		type: 'text',
		placeholder: '993',
	},
	{
		label: __('Outgoing server'),
		name: 'smtp_server',
		type: 'text',
		placeholder: 'smtp.yourcompany.com',
	},
	{
		label: __('Outgoing port'),
		name: 'smtp_port',
		type: 'text',
		placeholder: '587',
	},
	{
		label: __('Login'),
		name: 'login',
		type: 'text',
		placeholder: __('Only if it differs from the email ID'),
	},
]

export const customServerSwitches: RenderField[] = [
	{
		label: __('Use IMAP'),
		name: 'use_imap',
		type: 'checkbox',
		description: __('Turn off to collect mail over POP3 instead.'),
	},
	{
		label: __('Incoming over SSL'),
		name: 'use_ssl',
		type: 'checkbox',
		description: __('Implicit SSL, which is what port 993 expects.'),
	},
	{
		label: __('Outgoing over SSL'),
		name: 'use_ssl_for_outgoing',
		type: 'checkbox',
		description: __(
			'Implicit SSL on port 465. Left off, the connection upgrades with STARTTLS on port 587.'
		),
	},
]

/**
 * RenderField, as the field union SettingsFields renders. The two shapes
 * already agree on label/name/placeholder/description; only the name for
 * "required" differs.
 */
export function toSettingsField(field: RenderField): SettingsField {
	if (field.type === 'checkbox')
		return {
			name: field.name,
			label: field.label,
			description: field.description,
			type: 'checkbox',
		}
	return {
		name: field.name,
		label: field.label,
		description: field.description,
		placeholder: field.placeholder,
		reqd: field.required,
		fullWidth: field.fullWidth,
		type: field.type,
	}
}

/**
 * Names match the Email Account `service` field options exactly so the backend
 * can map each to its host/port presets — except Custom, which has none and is
 * stored as a blank service.
 */
export const services: EmailService[] = [
	{
		name: 'GMail',
		icon: LogoGmail,
		get description() {
			return __('Send and receive through your Gmail account')
		},
		info: __(`Setting up GMail requires you to enable two factor authentication
		  and app specific passwords. Read more`),
		link: 'https://support.google.com/accounts/answer/185833',
		custom: false,
	},
	{
		name: 'Outlook.com',
		icon: LogoOutlook,
		get description() {
			return __('Send and receive through your Outlook account')
		},
		info: __(`Setting up Outlook requires you to enable two factor authentication
		  and app specific passwords. Read more`),
		link: 'https://support.microsoft.com/en-us/account-billing/how-to-get-and-use-app-passwords-5896ed9b-4263-e681-128a-a6f2979a7944',
		custom: false,
	},
	{
		name: 'Sendgrid',
		icon: LogoSendgrid,
		get description() {
			return __('Send through your SendGrid account')
		},
		info: __(`Setting up Sendgrid requires you to enable two factor authentication
		  and app specific passwords. Read more`),
		link: 'https://sendgrid.com/docs/ui/account-and-settings/two-factor-authentication/',
		custom: false,
	},
	{
		name: 'SparkPost',
		icon: LogoSparkpost,
		get description() {
			return __('Send through your SparkPost account')
		},
		info: __(`Setting up SparkPost requires you to enable two factor authentication
		  and app specific passwords. Read more`),
		link: 'https://support.sparkpost.com/docs/my-account-and-profile/enabling-two-factor-authentication',
		custom: false,
	},
	{
		name: 'Yahoo Mail',
		icon: LogoYahoo,
		get description() {
			return __('Send and receive through your Yahoo Mail account')
		},
		info: __(`Setting up Yahoo requires you to enable two factor authentication
		  and app specific passwords. Read more`),
		link: 'https://help.yahoo.com/kb/SLN15241.html',
		custom: false,
	},
	{
		name: 'Yandex.Mail',
		icon: LogoYandex,
		get description() {
			return __('Send and receive through your Yandex Mail account')
		},
		info: __(`Setting up Yandex requires you to enable two factor authentication
		  and app specific passwords. Read more`),
		link: 'https://yandex.com/support/id/authorization/app-passwords.html',
		custom: false,
	},
	{
		name: FRAPPE_MAIL,
		icon: LogoFrappeMail,
		get description() {
			return __('Send and receive through Frappe Mail')
		},
		info: __(
			`Setting up Frappe Mail requires you to have an API key and API Secret of your email account. Read more`
		),
		link: 'https://github.com/frappe/mail',
		custom: true,
	},
	{
		name: CUSTOM_SERVICE,
		icon: '',
		get description() {
			return __('Connect any IMAP/POP3 and SMTP server')
		},
		info: __(
			`Any IMAP/POP3 and SMTP server your provider gives you the host and port for. Read more`
		),
		link: 'https://docs.frappe.io/framework/user/en/setting-up-email',
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

type EmailAccountFormState = {
	email_account_name?: string
	email_id?: string
	service?: string
	password?: string
	api_key?: string
	api_secret?: string
	frappe_mail_site?: string
	smtp_server?: string
}

/**
 * `allowMissingCredentials` is what an existing account is read under: the
 * endpoints hand back no password, API key or API secret, so a blank one is the
 * form never having been given the stored value rather than the user
 * withholding it. The update endpoint reads a blank the same way and leaves the
 * stored credential alone.
 */
export function validateInputs(
	state: EmailAccountFormState,
	service: string,
	allowMissingCredentials = false
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
	if (service === FRAPPE_MAIL) {
		if (!state.api_key && !allowMissingCredentials) {
			return __('API Key is required')
		}
		if (!state.api_secret && !allowMissingCredentials) {
			return __('API Secret is required')
		}
		return ''
	}
	// Nothing presets a custom account's hosts, so an outgoing server that was
	// left blank is a send that fails at the first mail rather than at save.
	if (service === CUSTOM_SERVICE && !state.smtp_server) {
		return __('Outgoing server is required')
	}
	if (!state.password && !allowMissingCredentials) {
		return __('Password is required')
	}
	return ''
}

/**
 * Which of the two site-wide defaults this account holds. Frappe allows one
 * default inbox and one default sender, and an account can be both, either or
 * neither, so the four cases are distinct rather than a flag.
 */
export function defaultsBadgeLabel(account: {
	default_incoming?: boolean | number
	default_outgoing?: boolean | number
	enable_incoming?: boolean | number
	enable_outgoing?: boolean | number
}): string {
	// Each default counts only for a direction the account is enabled for, which
	// is the same reading the row menu takes: frappe resolves a default inbox as
	// `enable_incoming` AND `default_incoming`, so the flag on a disabled
	// direction is one nothing consults. Reporting it anyway advertised a "Default
	// Inbox" whose "Clear default inbox" entry the menu had already withdrawn.
	const inbox = Boolean(account.default_incoming && account.enable_incoming)
	const sending = Boolean(account.default_outgoing && account.enable_outgoing)

	if (inbox && sending) {
		return __('Default Sending & Inbox')
	}
	if (inbox) {
		return __('Default Inbox')
	}
	if (sending) {
		return __('Default Sending')
	}
	// Holding neither default says nothing about direction. The column is headed
	// "Role", so falling through to Inbox labelled every send-only relay as one
	// that receives mail.
	if (account.enable_incoming && account.enable_outgoing) {
		return __('Sending & Inbox')
	}
	if (account.enable_outgoing) {
		return __('Sending')
	}
	if (account.enable_incoming) {
		return __('Inbox')
	}
	return __('Disabled')
}

// default_incoming/default_outgoing are absent on purpose: update_email_account
// leaves an absent field untouched, and Communication > General is this
// singleton's only writer now -- echoing back whatever this form last loaded
// would let a stale open tab clobber a default set from there meanwhile.
const commonPayload = (state: EmailAccountState) => ({
	email_id: state.email_id,
	service: state.service,
	enable_incoming: state.enable_incoming,
	enable_outgoing: state.enable_outgoing,
})

/** The host, port and encryption fields, sent only for a custom server. */
const customServerPayload = (state: EmailAccountState) => ({
	email_server: state.email_server,
	incoming_port: state.incoming_port,
	smtp_server: state.smtp_server,
	smtp_port: state.smtp_port,
	use_imap: state.use_imap ? 1 : 0,
	use_ssl: state.use_ssl ? 1 : 0,
	use_ssl_for_outgoing: state.use_ssl_for_outgoing ? 1 : 0,
	login: state.login,
})

/** What create_email_account is sent. Frappe Mail carries a key, not a password. */
export const buildCreatePayload = (state: EmailAccountState) => {
	const payload = {
		email_account_name: state.email_account_name,
		...commonPayload(state),
	}
	if (state.service === FRAPPE_MAIL)
		return {
			...payload,
			frappe_mail_site: state.frappe_mail_site,
			api_key: state.api_key,
			api_secret: state.api_secret,
		}
	if (state.service === CUSTOM_SERVICE)
		return {
			...payload,
			...customServerPayload(state),
			password: state.password,
		}
	return { ...payload, password: state.password }
}

/**
 * What update_email_account is sent. The account name is absent on purpose: it
 * is the document id, so changing it is a rename rather than a write.
 *
 * This one goes straight at the document, so unlike the create payload it
 * writes the document's own field names: no `service` for a custom server, and
 * the login split across the two fields Email Account keeps it in. A credential
 * that goes over blank is left as it is — the endpoint never handed one back
 * for the form to show.
 */
export const buildUpdatePayload = (state: EmailAccountState) => {
	if (state.service === FRAPPE_MAIL)
		return {
			...commonPayload(state),
			frappe_mail_site: state.frappe_mail_site,
			api_key: state.api_key,
			api_secret: state.api_secret,
		}
	if (state.service === CUSTOM_SERVICE) {
		const { login, ...server } = customServerPayload(state)
		const differs = Boolean(login) && login !== state.email_id
		return {
			...commonPayload(state),
			service: '',
			...server,
			// Implicit SSL and STARTTLS are exclusive; a server asked for both
			// refuses the handshake.
			use_tls: state.use_ssl_for_outgoing ? 0 : 1,
			login_id_is_different: differs ? 1 : 0,
			login_id: differs ? login : '',
			password: state.password,
		}
	}
	return { ...commonPayload(state), password: state.password }
}

const accountLabel = (row: SettingsListRow): string =>
	row.email_account_name || row.name || ''

const removeAccount = async (row: SettingsListRow) => {
	try {
		await call(METHOD.remove, { name: row.name })
		toast.success(__('Email Account deleted successfully'))
		await reloadSettingsLists(DOCTYPE)
	} catch (err: any) {
		toast.error(
			cleanError(err.messages?.[0] || err) || __('Error deleting email account')
		)
	}
}

const confirmDeletion = (row: SettingsListRow) => {
	createDialog({
		title: __('Delete {0}?').format(accountLabel(row)),
		message: __(
			'This permanently deletes the email account and cannot be undone.'
		),
		size: 'sm',
		actions: [
			{
				label: __('Delete'),
				theme: 'red',
				variant: 'solid',
				onClick({ close }: { close: () => void }) {
					removeAccount(row).then(close)
				},
			},
		],
	})
}

const columns: SettingsListColumn[] = [
	{
		key: 'account',
		get label() {
			return __('Account')
		},
		type: 'stacked',
		primary: (row) => row.email_account_name,
		secondary: (row) => row.email_id,
		// The provider's logo, as the list's avatar. It used to be drawn through
		// SettingsList's `leading` slot, which a config module cannot reach into.
		avatar: (row) => ({
			image: emailIcon[row.service],
			label: row.email_account_name,
		}),
	},
	{
		key: 'defaults',
		get label() {
			return __('Role')
		},
		type: 'badge',
		// Wide enough for the longest label, "Default Sending & Inbox".
		width: '11rem',
		badges: (row) => [{ label: defaultsBadgeLabel(row), theme: 'gray' }],
	},
	{
		key: 'actions',
		type: 'actions',
		ariaLabel: (row) => __('Actions for {0}').format(accountLabel(row)),
		options: (row) => [
			{
				label: __('Delete'),
				icon: 'lucide-trash-2',
				onClick: () => confirmDeletion(row),
			},
		],
	},
]

// Loaded on demand, and that is what keeps the two files apart rather than a
// preference: the form reads its field sets and payload builders from here, so
// naming it with a static import would close a cycle — whichever of the two was
// entered first would reach this line with the other still half-evaluated.
const form = markRaw(
	defineAsyncComponent(() => import('./EmailAccountForm.vue'))
)

// Same reason as `form`: it reads `services` from this module.
const emptyState = markRaw(
	defineAsyncComponent(() => import('./EmailAccountsEmptyState.vue'))
)

export const emailAccountsPage: ListPage = {
	kind: 'list',
	resource: {
		doctype: DOCTYPE,
		// Read by the endpoint, not by a get_list call — it applies its own
		// search, its own page length and its own scope. The doctype above is
		// carried anyway, as the key `reloadSettingsLists` refetches this list
		// by; the fields, so the row shape a column reaches for is written down
		// in one place. The accounts frappe ships as examples are hidden by the
		// endpoint, which is the only place a method-backed list can hide them.
		method: METHOD.list,
		fields: ACCOUNT_FIELDS,
		pageLength: EMAIL_ACCOUNTS_PAGE_LENGTH,
	},
	columns,
	searchable: true,
	empty: { name: 'Email Accounts', icon: 'lucide-mail' },
	emptyContent: { component: emptyState },
	create: { detail: { kind: 'custom', component: form } },
	rowDetail: { kind: 'custom', component: form },
}
