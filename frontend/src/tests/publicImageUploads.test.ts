/**
 * Every FileUploader must state, in its own markup, whether the File it creates
 * is public or private.
 *
 * Two defaults conspire against that. frappe-ui's FileUploader fills in
 * `{ private: true }` whenever uploadArgs says nothing about it
 * (FileUploader.vue:82-86), and frappe's upload_file defaults is_private to 1
 * (handler.py:152). A File that lands private and unattached is readable only by
 * its owner and Administrator (File.has_permission), so everyone else —
 * including the Guest rendering /login, and the crawler fetching an Open Graph
 * image — gets a broken image with no error anywhere.
 *
 * The ratchet below deliberately has NO exemption list. An exemption keyed on a
 * filename goes stale silently: the entry outlives the reason for it, and it
 * disables the check for every uploader in that file rather than the one that
 * was justified. Requiring an explicit `private:` instead means a genuinely
 * private uploader — the SCORM zip, a résumé, an assignment submission — says so
 * in the markup a reviewer is already reading.
 */
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

vi.mock('frappe-ui', () => ({
	FileUploader: {
		name: 'FileUploader',
		props: ['uploadArgs', 'fileTypes', 'fileType', 'validateFile'],
		template: '<div />',
	},
	Button: { template: '<button><slot /></button>' },
	FormLabel: { props: ['label', 'required'], template: '<label />' },
	toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/utils', () => ({ validateFile: () => undefined }))

vi.stubGlobal('__', (s: string) => s)

const uploadArgsOf = (wrapper: ReturnType<typeof mount>): unknown =>
	wrapper.findComponent({ name: 'FileUploader' }).props('uploadArgs')

// ImageUploader and the row that wraps it are shared by the brand logo, the
// badge image and a payment gateway's attachment, so they carry the caller's
// answer rather than one of their own.
describe('the shared image controls forward the privacy they are given', () => {
	const mountUploader = async (props: Record<string, unknown>) => {
		const ImageUploader = (
			await import('@/components/Controls/ImageUploader.vue')
		).default
		return mount(ImageUploader, {
			props,
			global: { mocks: { __: (s: string) => s } },
		})
	}

	const mountField = async (props: Record<string, unknown>) => {
		const ImageUploadField = (
			await import('@/components/Controls/ImageUploadField.vue')
		).default
		return mount(ImageUploadField, {
			props: { label: 'Brand Logo', ...props },
			global: { mocks: { __: (s: string) => s } },
		})
	}

	it('uploads public when the caller says so — the brand logo, a badge', async () => {
		expect(uploadArgsOf(await mountUploader({ is_private: false }))).toEqual({
			private: false,
		})
		expect(uploadArgsOf(await mountField({ is_private: false }))).toEqual({
			private: false,
		})
	})

	it('uploads private when the caller says so — a gateway attachment', async () => {
		expect(uploadArgsOf(await mountUploader({ is_private: true }))).toEqual({
			private: true,
		})
		expect(uploadArgsOf(await mountField({ is_private: true }))).toEqual({
			private: true,
		})
	})

	// Neither control defaults it. A call site that forgets leaves the key
	// undefined, and FileUploader reads that as private, the safe end.
	it('never invents public for a caller that said nothing', async () => {
		expect(uploadArgsOf(await mountUploader({}))).not.toMatchObject({
			private: false,
		})
		expect(uploadArgsOf(await mountField({}))).not.toMatchObject({
			private: false,
		})
	})
})

describe('public uploaders declare private: false', () => {
	it('Uploader — profile, badge, company logo, batch meta image, course image', async () => {
		const Uploader = (await import('@/components/Controls/Uploader.vue'))
			.default
		const w = mount(Uploader, {
			props: { modelValue: null },
			global: { mocks: { __: (s: string) => s } },
		})
		expect(uploadArgsOf(w)).toMatchObject({ private: false })
	})
})

// SettingsFields renders whatever the backend labels type 'Upload'; only a
// field that opts in may be public, though get_transformed_fields maps EVERY
// Attach / Attach Image field of a third-party <Gateway> doctype to that type.
describe('SettingsFields leaves privacy to the field', () => {
	const mountFields = async (field: Record<string, unknown>) => {
		const SettingsFields = (
			await import('@/components/Layouts/settings/desktop/SettingsFields.vue')
		).default
		return mount(SettingsFields, {
			props: {
				sections: [{ fields: [field] }],
				data: {},
			},
			global: { mocks: { __: (s: string) => s } },
		})
	}

	it('uploads public only when the field opts in', async () => {
		const w = await mountFields({
			label: 'Meta Image',
			name: 'meta_image',
			type: 'upload',
			public: true,
		})
		expect(uploadArgsOf(w)).toMatchObject({ private: false })
	})

	it('keeps a gateway attachment private by default', async () => {
		const w = await mountFields({
			label: 'Merchant QR',
			name: 'merchant_qr',
			type: 'upload',
		})
		expect(uploadArgsOf(w)).toMatchObject({ private: true })
	})
})

// tsconfig sets `types: []`, so node's globals aren't ambient here.
declare const process: { cwd(): string }

const vueFilesUnder = (dir: string): string[] => {
	const found: string[] = []
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name)
		if (entry.isDirectory()) found.push(...vueFilesUnder(full))
		else if (entry.name.endsWith('.vue')) found.push(full)
	}
	return found
}

/**
 * Every opening uploader tag, ending at the first `>` that is NOT
 * inside an attribute value. RichTextEditor counts: it uploads pasted and
 * dragged images too (its uploadFile defaults them to private), so a lesson body
 * written in one decides privacy exactly as a FileUploader does. The app has no
 * <TextEditor — that name matched nothing at all. A naive /[^>]*>/ stops at the `>` of the first
 * `=>` in an arrow-function attribute, which makes the whole check depend on
 * the order the attributes happen to be written in.
 */
const UPLOADER_TAGS = [
	'<FileUploader',
	'<RichTextEditor',
	'<ImageUploader',
	'<ImageUploadField',
]

/**
 * The two controls between a call site and its FileUploader: neither decides
 * privacy, each forwards the caller's `is_private`. Their call sites are
 * scanned too, read off `is_private` instead of `uploadArgs`.
 */
const FORWARDING_TAGS = ['<ImageUploader', '<ImageUploadField']

const openingTags = (source: string): string[] =>
	UPLOADER_TAGS.flatMap((marker) => openingTagsFor(source, marker))

const openingTagsFor = (source: string, marker: string): string[] => {
	const tags: string[] = []

	for (
		let i = source.indexOf(marker);
		i !== -1;
		i = source.indexOf(marker, i + 1)
	) {
		// Guard against matching a longer component name that starts the same way.
		if (/[\w-]/.test(source[i + marker.length] ?? '')) continue

		let quote: string | null = null
		for (let j = i + marker.length; j < source.length; j++) {
			const char = source[j]
			if (quote) {
				if (char === quote) quote = null
			} else if (char === '"' || char === "'") {
				quote = char
			} else if (char === '>') {
				tags.push(source.slice(i, j + 1))
				break
			}
		}
	}
	return tags
}

/** The raw expression bound to :uploadArgs / v-bind:uploadArgs, if any. */
const uploadArgsExpression = (tag: string): string | null => {
	const match = tag.match(/(?::|v-bind:)uploadArgs\s*=\s*("|')([\s\S]*?)\1/)
	return match ? match[2].trim() : null
}

/** The raw expression bound to :is_private / :is-private, if any. */
const isPrivateExpression = (tag: string): string | null => {
	const match = tag.match(/(?::|v-bind:)is[-_]private\s*=\s*("|')([\s\S]*?)\1/)
	return match ? match[2].trim() : null
}

type Privacy = 'public' | 'private' | 'per-field' | 'computed' | 'undeclared'

const forwardedPrivacyOf = (tag: string): Privacy => {
	const expression = isPrivateExpression(tag)
	if (expression === null) return 'undeclared'
	if (/^(false|0)$/.test(expression)) return 'public'
	if (/^(true|1)$/.test(expression)) return 'private'
	return 'per-field'
}

const privacyOf = (tag: string): Privacy => {
	if (FORWARDING_TAGS.some((marker) => tag.startsWith(marker)))
		return forwardedPrivacyOf(tag)

	const expression = uploadArgsExpression(tag)
	if (expression === null) return 'undeclared'
	if (!expression.startsWith('{')) return 'computed'
	if (/\b(private|is_private)\s*:\s*(false|0)\b/.test(expression))
		return 'public'
	if (/\b(private|is_private)\s*:\s*(true|1)\b/.test(expression))
		return 'private'
	if (/\b(private|is_private)\s*:/.test(expression)) return 'per-field'
	return 'undeclared'
}

/**
 * Every uploader in the app, in document order, with the privacy it must have.
 *
 * This is an assertion list, not an exemption list: a new uploader makes the
 * count mismatch and fails, rather than slipping through unnoticed. Flipping an
 * existing one fails too. Adding an entry here is the deliberate act of saying
 * who is allowed to read the file.
 */
const MANIFEST: Record<string, Privacy[]> = {
	// The two shared image controls, which forward rather than decide. Their
	// callers are the entries that say public or private.
	'components/Controls/ImageUploader.vue': ['per-field'],
	'components/Controls/ImageUploadField.vue': ['per-field'],
	// Learner- and crawler-facing: these must stay readable without a session.
	'components/Controls/Uploader.vue': ['public'],
	// The brand logo and the favicon, rendered on /login for Guest.
	'components/Settings/BrandSettings.vue': ['public', 'public'],
	'components/Controls/VideoPreviewField.vue': ['public', 'public'],
	'components/Modals/EditCoverImage.vue': ['public'],
	'components/UnsplashImageBrowser.vue': ['public'],
	'components/Courses/CourseThumbnailField.vue': ['public', 'public'],
	// Deliberately not readable by other users.
	'components/Assignment.vue': ['private', 'private', 'private'],
	'components/Modals/JobApplicationModal.vue': ['private'],
	'pages/Forms/ChapterForm.vue': ['private'],
	'components/Notes/Notes.vue': ['private'],
	// A gateway's attachment keeps the privacy SettingsFields gave it before the
	// form was hand-rolled: get_transformed_fields sets no `public` flag on any
	// of them, so `:is_private="true"` here is what keeps it private.
	'components/Settings/PaymentGateways/PaymentGatewayForm.vue': ['private'],
	// Neither literal. `per-field` reads the field's own `public` flag,
	// `computed` is any other expression, and `undeclared` passes no uploadArgs
	// at all, which for a RichTextEditor means private (its uploadFile defaults
	// `private: true`). That's why an image pasted into a lesson body can end up
	// invisible to everyone but its author; auditing those sites is separate,
	// deliberately not done here.
	'components/ContactUsEmail.vue': ['undeclared'],
	'components/DiscussionReplies.vue': ['undeclared', 'undeclared'],
	'components/Modals/DiscussionModal.vue': ['undeclared'],
	'components/Quiz.vue': ['undeclared'],
	'components/Settings/EmailTemplate/EmailTemplateAdd.vue': ['undeclared'],
	'components/Settings/EmailTemplate/EmailTemplateEdit.vue': ['undeclared'],
	// SettingsFields draws its upload field (ImageUploadField, per-field) ahead
	// of its richtext field (RichTextEditor, undeclared) in document order, but
	// openingTags groups matches by tag marker first, and RichTextEditor's
	// marker sorts ahead of ImageUploadField's in UPLOADER_TAGS — so the
	// undeclared entry lands first here regardless of source order.
	'components/Layouts/settings/desktop/SettingsFields.vue': [
		'undeclared',
		'per-field',
	],
	'components/UploadPlugin.vue': ['computed'],
	'pages/Forms/AssignmentForm.vue': ['undeclared'],
	'pages/Forms/AnnouncementForm.vue': ['undeclared'],
	'pages/Batches/BatchForm.vue': ['undeclared'],
	'pages/Forms/EmailTemplateForm.vue': ['undeclared'],
	'pages/Forms/NewBatchForm.vue': ['undeclared'],
	'components/Courses/CourseOverviewSection.vue': ['undeclared'],
	'pages/Forms/NewCourseForm.vue': ['undeclared'],
	'pages/JobApplications.vue': ['undeclared'],
	'pages/Forms/JobForm.vue': ['undeclared'],
	'pages/Forms/ProfileEditForm.vue': ['undeclared'],
	'pages/Forms/ProgrammingExerciseForm.vue': ['undeclared'],
}

describe('every uploader has the privacy the manifest states', () => {
	const SRC = resolve(process.cwd(), 'src')
	const files = vueFilesUnder(SRC)

	const found: Record<string, Privacy[]> = {}
	for (const file of files) {
		const tags = openingTags(readFileSync(file, 'utf8'))
		if (!tags.length) continue
		found[relative(SRC, file).split(/[\\/]/).join('/')] = tags.map(privacyOf)
	}

	it('found uploaders to scan', () => {
		expect(files.length).toBeGreaterThan(100)
		expect(Object.keys(found).length).toBeGreaterThan(5)
	})

	it('captures the whole opening tag, not just up to the first arrow function', () => {
		// A naive /[^>]*>/ stops at the `>` of the first `=>`, which would make
		// the check depend on the order attributes happen to be written in.
		const withArrow = files
			.flatMap((f) => openingTags(readFileSync(f, 'utf8')))
			.filter((tag) => tag.includes('=>'))
		expect(withArrow.length).toBeGreaterThan(0)
		for (const tag of withArrow) {
			expect(tag.trimEnd().slice(-1)).toBe('>')
		}
	})

	it('matches the manifest exactly — no new, moved or flipped uploader', () => {
		expect(found).toEqual(MANIFEST)
	})
})
