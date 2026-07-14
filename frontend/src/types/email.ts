export interface RenderField {
	label: string
	name: string
	type: 'text' | 'email' | 'password' | 'checkbox'
	placeholder?: string
	description?: string
	required?: boolean
}

export interface EmailService {
	name: string
	icon: string
	info: string
	link: string
	custom: boolean
}

export type EmailStep = 'email-list' | 'email-add' | 'email-edit'

export interface EmailAccount {
	name?: string
	email_account_name: string
	email_id: string
	service: string
	api_key?: string
	api_secret?: string
	password?: string
	frappe_mail_site?: string
	enable_incoming?: boolean
	enable_outgoing?: boolean
	default_incoming?: boolean
	default_outgoing?: boolean
	domain?: string
	email_server?: string
	smtp_server?: string
	incoming_port?: string | number
	smtp_port?: string | number
	use_ssl?: boolean | number
	use_starttls?: boolean | number
	use_tls?: boolean | number
	use_ssl_for_outgoing?: boolean | number
	validate_ssl_certificate?: boolean | number
	validate_ssl_certificate_for_outgoing?: boolean | number
	attachment_limit?: string | number
	append_emails_to_sent_folder?: boolean | number
	sent_folder_name?: string
}

export interface EmailTemplate {
	name: string
	subject?: string
	reference_doctype?: string
	use_html?: boolean | number
	response?: string
	response_html?: string
}

export type EmailTemplateStep =
	| 'template-list'
	| 'template-new'
	| 'template-edit'
