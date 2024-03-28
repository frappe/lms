import {
	aa as T,
	r as L,
	ab as U,
	d as w,
	k as M,
	x as u,
	F as D,
	G as c,
	H as s,
	L as n,
	y as m,
	J as i,
	K as e,
	a7 as x,
	a4 as b,
	ax as H,
	D as P,
	s as Y,
	M as F,
	a6 as B,
	a8 as z,
} from "./frappe-ui-n1bXVQkV.js";
import { a as J, d as N, c as A } from "./index-xt-hKVBz.js";
import { F as q } from "./file-text-dAqD9clk.js";
import { M as E } from "./map-pin-Ko1oZ6mp.js";
/**
 * @license lucide-vue-next v0.309.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const I = J("FlagIcon", [
	[
		"path",
		{
			d: "M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z",
			key: "i9b6wo",
		},
	],
	["line", { x1: "4", x2: "4", y1: "22", y2: "15", key: "1cm3nv" }],
]);
/**
 * @license lucide-vue-next v0.309.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const R = J("SendHorizontalIcon", [
		["path", { d: "m3 3 3 9-3 9 19-9Z", key: "1aobqy" }],
		["path", { d: "M6 12h16", key: "s4cdu5" }],
	]),
	G = { class: "flex flex-col gap-4" },
	K = { key: 0 },
	O = { class: "" },
	Z = { key: 1, class: "flex items-center" },
	Q = { class: "border rounded-md p-2 mr-2" },
	W = { class: "flex flex-col" },
	X = { class: "text-sm text-gray-500 mt-1" },
	ee = {
		__name: "JobApplicationModal",
		props: T(
			{ job: { type: String, required: !0 } },
			{ modelValue: {}, modelModifiers: {} }
		),
		emits: ["update:modelValue"],
		setup(f) {
			const r = L(null),
				h = U(f, "modelValue"),
				_ = w("$user"),
				y = f,
				t = (p) => {
					if (p.name.split(".").pop().toLowerCase() != "pdf")
						return "Only PDF file is allowed";
				},
				v = M({
					url: "frappe.client.insert",
					makeParams(p) {
						var o, a;
						return {
							doc: {
								doctype: "LMS Job Application",
								user: (o = _.data) == null ? void 0 : o.name,
								resume:
									(a = r.value) == null
										? void 0
										: a.file_name,
								job: y.job,
							},
						};
					},
				}),
				j = (p) => {
					v.submit(
						{},
						{
							validate() {
								if (!r.value)
									return "Please upload your resume";
							},
							onSuccess() {
								A({
									title: "Success",
									text: "Your application has been submitted",
									icon: "check",
									iconClasses:
										"bg-green-600 text-white rounded-md p-px",
								});
							},
							onError(o) {
								var a;
								A({
									title: "Error",
									text:
										((a = o.messages) == null
											? void 0
											: a[0]) || o,
									icon: "x",
									iconClasses:
										"bg-red-600 text-white rounded-md p-px",
									position: "top-center",
									timeout: 10,
								});
							},
						}
					);
				};
			return (p, o) => (
				u(),
				D(
					e(P),
					{
						modelValue: h.value,
						"onUpdate:modelValue":
							o[1] || (o[1] = (a) => (h.value = a)),
						class: "text-base",
						options: {
							title: p.__("Apply for this job"),
							size: "lg",
							actions: [
								{
									label: "Submit",
									variant: "solid",
									onClick: (a) => {
										j();
									},
								},
							],
						},
					},
					{
						"body-content": c(() => [
							s("div", G, [
								s(
									"p",
									null,
									n(
										p.__(
											"Submit your resume to proceed with your application for this position. Upon submission, it will be shared with the job poster."
										)
									),
									1
								),
								r.value
									? (u(),
									  m("div", Z, [
											s("div", Q, [
												i(e(q), {
													class: "h-5 w-5 stroke-1.5 text-gray-700",
												}),
											]),
											s("div", W, [
												s(
													"span",
													null,
													n(r.value.file_name),
													1
												),
												s(
													"span",
													X,
													n(e(N)(r.value.file_size)),
													1
												),
											]),
									  ]))
									: (u(),
									  m("div", K, [
											i(
												e(H),
												{
													fileTypes: [".pdf"],
													validateFile: t,
													onSuccess:
														o[0] ||
														(o[0] = (a) => {
															r.value = a;
														}),
												},
												{
													default: c(
														({
															file: a,
															progress: l,
															uploading: d,
															openFileSelector: g,
														}) => [
															s("div", O, [
																i(
																	e(x),
																	{
																		onClick:
																			g,
																		loading:
																			d,
																	},
																	{
																		default:
																			c(
																				() => [
																					b(
																						n(
																							d
																								? `Uploading ${l}%`
																								: "Upload your resume"
																						),
																						1
																					),
																				]
																			),
																		_: 2,
																	},
																	1032,
																	[
																		"onClick",
																		"loading",
																	]
																),
															]),
														]
													),
													_: 1,
												},
												8,
												["fileTypes"]
											),
									  ])),
							]),
						]),
						_: 1,
					},
					8,
					["modelValue", "options"]
				)
			);
		},
	},
	se = { class: "text-base h-screen" },
	te = {
		class: "sticky top-0 z-10 flex items-center justify-between border-b bg-white px-3 py-2.5 sm:px-5",
	},
	oe = { key: 0, class: "flex" },
	ae = { key: 1 },
	le = { key: 0 },
	ie = { class: "p-5 sm:p-5" },
	ne = { class: "flex mb-4" },
	re = ["src"],
	de = { class: "text-2xl font-semibold mb-2" },
	ce = { class: "font-medium" },
	pe = { class: "font-medium" },
	ue = { class: "flex items-center mt-2" },
	me = ["innerHTML"],
	ye = {
		__name: "JobDetail",
		props: { job: { type: String, required: !0 } },
		setup(f) {
			var o, a;
			const r = w("$user"),
				h = w("$dayjs"),
				_ = L(!1),
				y = f,
				t = M({
					url: "lms.lms.api.get_job_details",
					params: { job: y.job },
					cache: ["job", y.job],
					auto: !0,
				}),
				v = M({
					url: "frappe.client.get_list",
					params: {
						doctype: "LMS Job Application",
						filters: {
							job: (o = t.data) == null ? void 0 : o.name,
							user: (a = r.data) == null ? void 0 : a.name,
						},
					},
				});
			Y(() => {
				var l;
				(l = r.data) != null && l.name && v.submit();
			});
			const j = () => {
					_.value = !0;
				},
				p = (l) => {
					window.location.href = `/login?redirect-to=/job-openings/${l}`;
				};
			return (l, d) => {
				var g, $, V, S;
				return (
					u(),
					m("div", se, [
						s("header", te, [
							i(
								e(B),
								{
									class: "h-7",
									items: [
										{
											label: l.__("Jobs"),
											route: { name: "Jobs" },
										},
										{
											label:
												(g = e(t).data) == null
													? void 0
													: g.job_title,
											route: {
												name: "JobDetail",
												params: {
													job:
														($ = e(t).data) == null
															? void 0
															: $.name,
												},
											},
										},
									],
								},
								null,
								8,
								["items"]
							),
							(V = e(r).data) != null && V.name
								? (u(),
								  m("div", oe, [
										i(
											e(x),
											{ class: "mr-2" },
											{
												prefix: c(() => [
													i(e(I), {
														class: "h-4 w-4",
													}),
												]),
												default: c(() => [
													b(
														" " + n(l.__("Report")),
														1
													),
												]),
												_: 1,
											}
										),
										(S = e(v).data) != null && S.length
											? F("", !0)
											: (u(),
											  D(
													e(x),
													{
														key: 0,
														variant: "solid",
														onClick:
															d[0] ||
															(d[0] = (k) => j()),
													},
													{
														prefix: c(() => [
															i(e(R), {
																class: "h-4 w-4",
															}),
														]),
														default: c(() => [
															b(
																" " +
																	n(
																		l.__(
																			"Apply"
																		)
																	),
																1
															),
														]),
														_: 1,
													}
											  )),
								  ]))
								: (u(),
								  m("div", ae, [
										i(
											e(x),
											{
												onClick:
													d[1] ||
													(d[1] = (k) => {
														var C;
														return p(
															(C = e(t).data) ==
																null
																? void 0
																: C.name
														);
													}),
											},
											{
												default: c(() => [
													s(
														"span",
														null,
														n(
															l.__(
																"Login to apply"
															)
														),
														1
													),
												]),
												_: 1,
											}
										),
								  ])),
						]),
						e(t).data
							? (u(),
							  m("div", le, [
									s("div", ie, [
										s("div", ne, [
											s(
												"img",
												{
													src: e(t).data.company_logo,
													class: "w-16 h-16 rounded-lg object-contain mr-4",
												},
												null,
												8,
												re
											),
											s("div", null, [
												s(
													"div",
													de,
													n(e(t).data.job_title),
													1
												),
												s("div", null, [
													b(
														n(l.__("posted by")) +
															" ",
														1
													),
													s(
														"span",
														ce,
														n(
															e(t).data
																.company_name
														),
														1
													),
													b(
														" " +
															n(l.__("on")) +
															" ",
														1
													),
													s(
														"span",
														pe,
														n(
															e(h)(
																e(t).data
																	.creation
															).format(
																"DD MMM YYYY"
															)
														),
														1
													),
												]),
												s("div", ue, [
													i(
														e(z),
														{
															label: e(t).data
																.type,
															theme: "green",
															size: "lg",
														},
														null,
														8,
														["label"]
													),
													i(
														e(z),
														{
															label: e(t).data
																.location,
															theme: "gray",
															size: "lg",
															class: "ml-4",
														},
														{
															prefix: c(() => [
																i(e(E), {
																	class: "h-4 w-4 stroke-1.5",
																}),
															]),
															_: 1,
														},
														8,
														["label"]
													),
												]),
											]),
										]),
										s(
											"p",
											{
												innerHTML:
													e(t).data.description,
												class: "ProseMirror prose prose-table:table-fixed prose-td:p-2 prose-th:p-2 prose-td:border prose-th:border prose-td:border-gray-300 prose-th:border-gray-300 prose-td:relative prose-th:relative prose-th:bg-gray-100 prose-sm max-w-none !whitespace-normal mt-6",
											},
											null,
											8,
											me
										),
									]),
									i(
										ee,
										{
											modelValue: _.value,
											"onUpdate:modelValue":
												d[2] ||
												(d[2] = (k) => (_.value = k)),
											job: e(t).data.name,
										},
										null,
										8,
										["modelValue", "job"]
									),
							  ]))
							: F("", !0),
					])
				);
			};
		},
	};
export { ye as default };
//# sourceMappingURL=JobDetail-1dm4725M.js.map
