/**
 * frappe-ui's labeling primitives, behind one LMS-owned import surface.
 *
 * They are exported from `frappe-ui/experimental`, whose header disclaims
 * backward compatibility. Routing every control through this file makes a
 * future break a one-file fix instead of a sweep across nine components.
 *
 * `LabelingWrapper` was dropped from `frappe-ui/experimental` in beta.65
 * (no replacement — apps compose `InputLabel` + the field +
 * `InputDescription`/`InputError` by hand). Removed here too since no LMS
 * component ever imported it through this file.
 *
 * `RequiredIndicator` and the `InputLabelingProps`/`FrappeUIError` types are
 * NOT re-exported by `frappe-ui/experimental` (verified by reading
 * experimental.ts) and nothing downstream needs them: `InputLabel` renders
 * `RequiredIndicator` internally, so a composing consumer never imports it
 * directly, and no later task touches the error type. Do not add them back
 * without a consumer: doing so previously forced a relative import into
 * `node_modules/frappe-ui/src/...`, reaching past the package's public
 * surface for no reason.
 */
export {
	InputLabel,
	InputDescription,
	InputError,
	useInputLabeling,
} from 'frappe-ui/experimental'
