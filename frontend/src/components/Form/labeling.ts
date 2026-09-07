/**
 * frappe-ui's labeling primitives, behind one LMS-owned import surface.
 *
 * They are exported from `frappe-ui/experimental`, whose header disclaims
 * backward compatibility, though `experimental.ts` and `useInputLabeling.ts`
 * are byte-identical from beta.24 through beta.29. Routing every control
 * through this file makes a future break a one-file fix instead of a sweep
 * across nine components.
 *
 * Only the five names `frappe-ui/experimental` actually re-exports live
 * here. `RequiredIndicator` and the `InputLabelingProps`/`FrappeUIError`
 * types are NOT re-exported by that module (verified by reading
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
	LabelingWrapper,
	useInputLabeling,
} from 'frappe-ui/experimental'
