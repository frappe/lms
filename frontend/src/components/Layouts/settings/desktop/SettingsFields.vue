<template>
	<div>
		<template v-for="(section, index) in sections" :key="index">
			<div
				v-if="section.label"
				class="text-p-lg-semibold text-ink-gray-8 mb-1"
				:class="{ 'mt-6': index > 0 }"
			>
				{{ __(section.label) }}
			</div>
			<div :class="flush ? '' : 'divide-y divide-outline-elevation-2'">
				<template
					v-for="(field, fieldIndex) in visibleFields(section)"
					:key="fieldIndex"
				>
					<div v-if="field.type == 'upload'" class="py-3">
						<ImageUploadField
							:icon="field.icon || 'lucide-image'"
							:label="__(field.label)"
							:description="uploadDescription(field)"
							:image_url="fileUrl(data[field.name]) || ''"
							:required="field.reqd"
							:is_private="!field.public"
							:disabled="field.disabled"
							@upload="(url) => setValue(field, url)"
							@remove="() => setValue(field, null)"
						/>
					</div>

					<div
						v-else-if="field.type == 'code'"
						class="py-3"
						@input="report(field, 'typing')"
						@focusout="report(field, 'now')"
					>
						<div
							data-testid="code-field-label"
							class="text-p-base-medium text-ink-gray-7 mb-2"
						>
							{{ __(field.label) }}
						</div>
						<CodeEditor
							:type="codeType(field)"
							v-model="data[field.name]"
							:height="codeHeight(field)"
							class="shrink-0"
							:required="field.reqd"
							:readonly="field.disabled"
							:showLineNumbers="true"
							:aria-label="__(field.label)"
						>
						</CodeEditor>
						<div
							v-if="field.description"
							data-testid="code-field-description"
							class="text-p-sm text-ink-gray-5 mt-2"
						>
							{{ __(field.description) }}
						</div>
					</div>

					<div
						v-else-if="field.type == 'textarea'"
						class="py-3"
						@input="report(field, 'typing')"
						@focusout="report(field, 'now')"
					>
						<div class="text-p-base-medium text-ink-gray-7 mb-2">
							{{ __(field.label) }}
						</div>
						<div :style="contentBox(section, field)">
							<FormControl
								type="textarea"
								:rows="field.rows || 3"
								v-model="data[field.name]"
								:disabled="field.disabled"
								:required="field.reqd"
								:aria-label="__(field.label)"
								:placeholder="field.placeholder || __(field.label)"
							/>
						</div>
						<div
							v-if="field.description"
							class="text-p-sm text-ink-gray-5 mt-2"
						>
							{{ __(field.description) }}
						</div>
					</div>

					<div v-else-if="field.type == 'richtext'" class="py-3">
						<div class="text-p-base-medium text-ink-gray-7 mb-2">
							{{ __(field.label) }}
						</div>
						<div :style="contentBox(section, field)">
							<RichTextEditor
								:content="data[field.name]"
								:editable="!field.disabled"
								:fixed-menu="true"
								:placeholder="field.placeholder || __(field.label)"
								editor-class="prose-sm max-w-none border-b border-x border-outline-elevation-2 bg-surface-gray-2 rounded-b-md py-1 px-2 min-h-[7rem] max-h-[13rem] overflow-y-auto"
								@change="(value) => onRichText(field, value)"
							/>
						</div>
						<div
							v-if="field.description"
							class="text-p-sm text-ink-gray-5 mt-2"
						>
							{{ __(field.description) }}
						</div>
					</div>

					<div
						v-else-if="field.type == 'password' && field.secret"
						class="py-3"
					>
						<div class="text-p-base-medium text-ink-gray-7 mb-2">
							{{ __(field.label) }}
						</div>
						<FormControl
							type="password"
							class="w-full"
							:model-value="secretValues[field.name] || ''"
							:required="field.reqd"
							:disabled="field.disabled"
							:aria-label="__(field.label)"
							:placeholder="
								hasStoredSecret(field)
									? __('Saved, leave blank to keep it')
									: field.placeholder || __(field.label)
							"
							@update:model-value="(value) => setSecret(field, value)"
						/>
						<div
							v-if="field.description"
							class="text-p-sm text-ink-gray-5 mt-2"
						>
							{{ __(field.description) }}
						</div>
					</div>

					<div
						v-else-if="field.fullWidth"
						class="py-3"
						:class="{ '!border-t-0': field.noDivider }"
						@input="onInput(field)"
						@focusout="onSettle(field)"
					>
						<div class="text-p-base-medium text-ink-gray-7 mb-2">
							{{ __(field.label) }}
						</div>
						<FormControl
							:key="field.name"
							v-model="data[field.name]"
							:type="field.type"
							:required="field.reqd"
							:disabled="field.disabled"
							:min="field.min"
							class="w-full"
							:aria-label="__(field.label)"
							:placeholder="field.placeholder || __(field.label)"
						/>
						<div
							v-if="field.description"
							class="text-p-sm text-ink-gray-5 mt-2"
						>
							{{ __(field.description) }}
						</div>
					</div>

					<div v-else class="flex items-center justify-between gap-4 py-3">
						<div class="flex flex-col">
							<div class="text-p-base-medium text-ink-gray-7">
								{{ __(field.label) }}
							</div>
							<div v-if="field.description" class="text-p-sm text-ink-gray-5">
								{{ __(field.description) }}
							</div>
						</div>
						<div class="shrink-0">
							<BooleanSwitch
								v-if="field.type == 'checkbox'"
								size="sm"
								:model-value="data[field.name]"
								:disabled="field.disabled"
								@update:model-value="(value) => onPick(field, value)"
							/>
							<Link
								v-else-if="field.type == 'link'"
								:model-value="displayValue(field)"
								:doctype="linkDoctype(field)"
								:filters="field.filters"
								:required="field.reqd"
								:readonly="field.disabled"
								:onCreate="createHandler(field)"
								:aria-label="__(field.label)"
								class="w-48"
								@update:model-value="(value) => onPick(field, value)"
							/>
							<Select
								v-else-if="field.type == 'select'"
								:model-value="displayValue(field)"
								:options="field.options"
								:disabled="field.disabled"
								:aria-label="__(field.label)"
								class="w-48"
								@update:model-value="(value) => onPick(field, value)"
							/>
							<span
								v-else
								class="contents"
								@input="onInput(field)"
								@focusout="onSettle(field)"
							>
								<FormControl
									:key="field.name"
									v-model="data[field.name]"
									:type="field.type"
									:rows="field.rows"
									:options="field.options"
									:required="field.reqd"
									:disabled="field.disabled"
									:min="field.min"
									class="w-48"
									:aria-label="__(field.label)"
									:placeholder="field.placeholder || __(field.label)"
								/>
							</span>
						</div>
					</div>
				</template>
			</div>
		</template>
	</div>
</template>
<script setup>
import { FormControl, Select } from 'frappe-ui'
import BooleanSwitch from '@/components/Controls/BooleanSwitch.vue'
import { reactive, watch } from 'vue'
import Link from '@/components/Controls/Link.vue'
import CodeEditor from '@/components/Controls/CodeEditor.vue'
import ImageUploadField from '@/components/Controls/ImageUploadField.vue'
import RichTextEditor from '@/components/RichTextEditor.vue'
import { seedCheckboxDefaults } from '@/components/Settings/Mobile/mobileRows'

// is_private="!field.public" is written inline deliberately: privacy is the
// FIELD's decision, not this component's. Third-party <Gateway> Settings
// fields (KYC documents, merchant QR codes) map to 'Upload' here, and only a
// field that opts in with `public: true` should be world-readable. Kept
// inline, not folded into a helper, because publicImageUploads.test.ts's
// ratchet would stop catching a flip to public behind an opaque call.

const props = defineProps({
	sections: {
		type: Array,
		required: true,
	},
	data: {
		type: Object,
		required: true,
	},
	// A settings page is unrelated rows; a record form is one block about one
	// thing, where the same divider rule only chops it into stripes. A form
	// asks for them off.
	flush: {
		type: Boolean,
		default: false,
	},
})

// No Update button here: a pick commits 'now'; text/number/code fields
// commit 'typing', debounced so partial values don't hit validate() mid-type.
// focusout also commits 'now' (blur doesn't bubble).
const emit = defineEmits(['commit', 'secret'])

// A `secret` field's typed value, kept out of `data` (see the schema's own
// note on why). Reports up via `@secret` instead of the normal commit path.
const secretValues = reactive({})

const hasStoredSecret = (field) => Boolean(props.data[field.name])

const setSecret = (field, value) => {
	secretValues[field.name] = value
	emit('secret', field.name, value)
}

// The template branches out switch, Link and select on its own. This is for
// everything the shared FormControl branch covers, where a radio or a date is
// still a pick and a text or number field is not.
const INSTANT_TYPES = [
	'checkbox',
	'radio',
	'select',
	'link',
	'combobox',
	'autocomplete',
	'date',
	'datetime',
	'datetime-local',
	'time',
	'upload',
]

// A field the document has hidden is not rendered, so it is neither written nor
// validated. Only Transactions' coupon block uses this.
const visibleFields = (section) =>
	section.fields.filter((field) => !field.showIf || field.showIf(props.data))

// The schema names a language like CodeMirror; CodeEditor names it like Ace.
// Not derivable from each other, so the mapping is spelled out. Unmapped
// falls back to HTML, matching every code field's prior default.
const CODE_TYPES = { htmlmixed: 'HTML', javascript: 'JavaScript', json: 'JSON' }

const codeType = (field) => CODE_TYPES[field.mode] || 'HTML'

// 25px a line, which is what the one pre-existing code field's `rows: 10` was
// already being drawn at back when the height was hardcoded to 250px. Its
// height must not move because a second field finally reads the number.
const codeHeight = (field) => `${(field.rows ?? 10) * 25}px`

const CONTENT_TYPES = ['textarea', 'richtext']

// Whether another content control stands in for this one. Two conditional
// fields in the same section at the same `rows` are two halves of one slot
// (Email Template's HTML body vs rich one, swapped by Use HTML).
const swapsWithSibling = (section, field) =>
	Boolean(field.showIf) &&
	section.fields.some(
		(other) =>
			other !== field &&
			Boolean(other.showIf) &&
			other.rows === field.rows &&
			CONTENT_TYPES.includes(other.type)
	)

// A swap slot reserves this height so nothing moves below it when the toggle
// flips. Only swap slots get it: the floor (1.5rem/line) comes out taller
// than the textarea it holds, which is dead space for a lone field.
const contentBox = (section, field) =>
	field.rows && swapsWithSibling(section, field)
		? { minHeight: `calc(${field.rows} * 1.5rem + 1.25rem)` }
		: undefined

// A `disabled` field is shown and never written: a consent flag or
// redemption count records what happened, not a setting. Enforced once here
// rather than per control, because a control can still report a change while
// uneditable (rich text fires `change` regardless), which would save a value
// nobody chose.
const setValue = (field, value) => {
	if (field.disabled) return
	props.data[field.name] = value
	emit('commit', 'now')
}

const report = (field, mode) => {
	if (!field.disabled) emit('commit', mode)
}

// The editor owns its own content, so it reports a new value rather than being
// written to. 'typing' and not 'now': it fires on every keystroke, and a body
// of prose sent a character at a time is what the rest period exists to stop.
const onRichText = (field, value) => {
	if (field.disabled) return
	props.data[field.name] = value
	emit('commit', 'typing')
}

// LMS Payment points a Link at whatever doctype a sibling field names, so the
// target can be a function of the document rather than a constant.
const linkDoctype = (field) =>
	typeof field.doctype === 'function'
		? field.doctype(props.data)
		: field.doctype

const commitMode = (field) =>
	INSTANT_TYPES.includes(field.type) ? 'now' : 'typing'

// The floor the schema declared for a number field, or null where it declared
// none. Only a stated bound is enforced, so a number field without a `min` goes
// through untouched.
const minOf = (field) =>
	field.type === 'number' && typeof field.min === 'number' ? field.min : null

const isBlank = (value) =>
	value === null || value === undefined || String(value).trim() === ''

// displayFallback is shown, never written: writing it would make the doc
// differ from originalDoc and mark the panel dirty on open, stuck at "Not
// saved". Checkbox `default` is seeded instead (seedCheckboxDefaults), since
// a null checkbox renders off but saves nothing, so an unseeded `1` would
// flip off behind the user's back.
const displayValue = (field) =>
	isBlank(props.data[field.name]) && field.displayFallback !== undefined
		? field.displayFallback
		: props.data[field.name]

// The user picked it, so it is written like any other value — including when
// what they picked is the fallback they were already being shown.
const onPick = (field, value) => setValue(field, value)

// Link shows its "Create New" footer whenever this handler exists, so a
// field with none must get none, or the button does nothing. The value
// passed is the name typed into the create box, i.e. the record just
// created, so it's written back like any pick, otherwise the field stays
// empty after create.
const createHandler = (field) =>
	field.onCreate
		? (value, close) => {
				field.onCreate(value, close)
				if (value) setValue(field, value)
		  }
		: undefined

// Cleared, non-numeric, or under the floor. The doctype's validate() rejects
// all three the same way, so this does too.
const isOutOfBounds = (field, value) => {
	const min = minOf(field)
	if (min === null) return false
	if (isBlank(value)) return true
	const number = Number(value)
	return Number.isNaN(number) || number < min
}

// The last in-bounds value a bounded field held, restored on an
// out-of-bounds edit. Last VALID, not the value at focus: an edit already
// written by the rest period could otherwise get rewound past, stranding the
// panel dirty with no way to clear the marker.
const lastGood = {}

const rememberBounded = (data) => {
	for (const section of props.sections)
		for (const field of section.fields)
			if (minOf(field) !== null) lastGood[field.name] = data[field.name]
}

const onInput = (field) => {
	if (field.disabled) return
	// Mid-type, an out-of-bounds value (an empty box between 3 and 15) is left
	// as typed and never written. But an earlier keystroke's rest period may
	// still be ticking against this now-invalid value, so disarm it: the field
	// holds something validate() would reject, and there's nothing safe to
	// save until it settles.
	if (isOutOfBounds(field, props.data[field.name])) {
		emit('commit', 'cancel')
		return
	}
	lastGood[field.name] = props.data[field.name]
	emit('commit', commitMode(field))
}

// Leaving the field is the only place a bound is enforced; an out-of-bounds
// value reverts to the last good one and is still reported, since the
// rollback only matches the server if that write actually fired. Otherwise
// the doc could sit dirty with no timer armed, stuck at "Not saved" forever.
// Reporting a clean field costs nothing: useAutosave's send() returns on
// `!isDirty`.
const onSettle = (field) => {
	if (field.disabled) return
	if (isOutOfBounds(field, props.data[field.name])) {
		props.data[field.name] = lastGood[field.name]
	}
	emit('commit', 'now')
}

// Attach fields arrive from the backend as a {file_name, file_url} object, but
// become a plain file_url string after a fresh upload. Handle both shapes.
const fileUrl = (value) =>
	value && typeof value === 'object' ? value.file_url : value

// The row has one description slot: a field with its own description uses
// it; otherwise it falls back to the attached file name, matching the old
// hand-written upload block and Payment Gateways' same fallback.
const uploadDescription = (field) =>
	field.description
		? __(field.description)
		: fileName(props.data[field.name]) || ''

const fileName = (value) => {
	const url = fileUrl(value)
	return value && typeof value === 'object' && value.file_name
		? value.file_name
		: (url || '').split('/').pop()
}

watch(
	() => props.data,
	(data) => {
		if (!data) return
		seedCheckboxDefaults(props.sections, data)
		// Re-seeded per document, so the first out-of-bounds edit after a load
		// has the loaded value to go back to rather than an undefined.
		rememberBounded(data)
	},
	{ immediate: true }
)
</script>
