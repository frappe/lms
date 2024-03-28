var me = Object.defineProperty;
var X = Object.getOwnPropertySymbols;
var _e = Object.prototype.hasOwnProperty,
	pe = Object.prototype.propertyIsEnumerable;
var ee = (m, b, o) =>
		b in m
			? me(m, b, {
					enumerable: !0,
					configurable: !0,
					writable: !0,
					value: o,
			  })
			: (m[b] = o),
	q = (m, b) => {
		for (var o in b || (b = {})) _e.call(b, o) && ee(m, o, b[o]);
		if (X) for (var o of X(b)) pe.call(b, o) && ee(m, o, b[o]);
		return m;
	};
var te = (m, b, o) =>
	new Promise((p, g) => {
		var l = (c) => {
				try {
					_(o.next(c));
				} catch (y) {
					g(y);
				}
			},
			s = (c) => {
				try {
					_(o.throw(c));
				} catch (y) {
					g(y);
				}
			},
			_ = (c) =>
				c.done ? p(c.value) : Promise.resolve(c.value).then(l, s);
		_((o = o.apply(m, b)).next());
	});
import {
	aa as z,
	d as C,
	ab as j,
	a as F,
	k as S,
	w as se,
	x as i,
	F as $,
	G as f,
	H as t,
	L as u,
	J as d,
	K as e,
	ag as H,
	ah as le,
	y as h,
	Q as w,
	R as A,
	I as O,
	M as V,
	D as I,
	r as B,
	a4 as L,
	a7 as D,
	b as Z,
	ae as ne,
	ai as P,
	T as ae,
	ac as he,
	a5 as ie,
	aj as be,
	ak as ye,
	P as de,
	al as ve,
	am as fe,
	an as ge,
	ao as re,
	ap as ke,
	aq as xe,
	j as R,
	W as $e,
	a6 as Ve,
	a8 as Ce,
	a9 as Se,
} from "./frappe-ui-n1bXVQkV.js";
import {
	a as M,
	f as E,
	c as Y,
	g as Me,
	t as we,
	B as Le,
} from "./index-xt-hKVBz.js";
import { _ as De } from "./CourseCard-I7Cj-Ne7.js";
import { C as J, a as G } from "./clock-nM1CyeA6.js";
import { P as ue } from "./plus-w56hNznP.js";
import { _ as je } from "./Link-xVzNCgtj.js";
import { _ as Ae } from "./Discussions-MQ_bdV9n.js";
import { B as Te } from "./book-open-check-c5K78KcT.js";
import "./UserAvatar-3mSOKoKa.js";
import "./star-O1ih2gFp.js";
/**
 * @license lucide-vue-next v0.309.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const Ue = M("Contact2Icon", [
	["path", { d: "M16 18a4 4 0 0 0-8 0", key: "1lzouq" }],
	["circle", { cx: "12", cy: "11", r: "3", key: "itu57m" }],
	[
		"rect",
		{ width: "18", height: "18", x: "3", y: "4", rx: "2", key: "1hopcy" },
	],
	["line", { x1: "8", x2: "8", y1: "2", y2: "4", key: "1ff9gb" }],
	["line", { x1: "16", x2: "16", y1: "2", y2: "4", key: "1ufoma" }],
]);
/**
 * @license lucide-vue-next v0.309.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const oe = M("InfoIcon", [
	["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
	["path", { d: "M12 16v-4", key: "1dtifu" }],
	["path", { d: "M12 8h.01", key: "e9boi3" }],
]);
/**
 * @license lucide-vue-next v0.309.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const Be = M("LaptopIcon", [
	[
		"path",
		{
			d: "M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16",
			key: "tarvll",
		},
	],
]);
/**
 * @license lucide-vue-next v0.309.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const Ee = M("LayoutDashboardIcon", [
	[
		"rect",
		{ width: "7", height: "9", x: "3", y: "3", rx: "1", key: "10lvy0" },
	],
	[
		"rect",
		{ width: "7", height: "5", x: "14", y: "3", rx: "1", key: "16une8" },
	],
	[
		"rect",
		{ width: "7", height: "9", x: "14", y: "12", rx: "1", key: "1hutg5" },
	],
	[
		"rect",
		{ width: "7", height: "5", x: "3", y: "16", rx: "1", key: "ldoo1y" },
	],
]);
/**
 * @license lucide-vue-next v0.309.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const Ne = M("MailIcon", [
	[
		"rect",
		{ width: "20", height: "16", x: "2", y: "4", rx: "2", key: "18n3k1" },
	],
	["path", { d: "m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7", key: "1ocrg3" }],
]);
/**
 * @license lucide-vue-next v0.309.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const Pe = M("MessageCircleIcon", [
	["path", { d: "M7.9 20A9 9 0 1 0 4 16.1L2 22Z", key: "vv11sd" }],
]);
/**
 * @license lucide-vue-next v0.309.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const Ye = M("MonitorIcon", [
	[
		"rect",
		{ width: "20", height: "14", x: "2", y: "3", rx: "2", key: "48i651" },
	],
	["line", { x1: "8", x2: "16", y1: "21", y2: "21", key: "1svkeh" }],
	["line", { x1: "12", x2: "12", y1: "17", y2: "21", key: "vw1qmm" }],
]);
/**
 * @license lucide-vue-next v0.309.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const ze = M("SendIcon", [
	["path", { d: "m22 2-7 20-4-9-9-4Z", key: "1q3vgg" }],
	["path", { d: "M22 2 11 13", key: "nzbqef" }],
]);
/**
 * @license lucide-vue-next v0.309.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const Ie = M("Trash2Icon", [
	["path", { d: "M3 6h18", key: "d0wm0j" }],
	["path", { d: "M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6", key: "4alrt4" }],
	["path", { d: "M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2", key: "v07s0e" }],
	["line", { x1: "10", x2: "10", y1: "11", y2: "17", key: "1uufr5" }],
	["line", { x1: "14", x2: "14", y1: "11", y2: "17", key: "xtxkd" }],
]);
/**
 * @license lucide-vue-next v0.309.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const qe = M("UserRoundCogIcon", [
	["path", { d: "M2 21a8 8 0 0 1 10.434-7.62", key: "1yezr2" }],
	["circle", { cx: "10", cy: "8", r: "5", key: "o932ke" }],
	["circle", { cx: "18", cy: "18", r: "3", key: "1xkwt0" }],
	["path", { d: "m19.5 14.3-.4.9", key: "1eb35c" }],
	["path", { d: "m16.9 20.8-.4.9", key: "dfjc4z" }],
	["path", { d: "m21.7 19.5-.9-.4", key: "q4dx6b" }],
	["path", { d: "m15.2 16.9-.9-.4", key: "1r0w5f" }],
	["path", { d: "m21.7 16.5-.9.4", key: "1knoei" }],
	["path", { d: "m15.2 19.1-.9.4", key: "j188fs" }],
	["path", { d: "m19.5 21.7-.4-.9", key: "1tonu5" }],
	["path", { d: "m16.9 15.2-.4-.9", key: "699xu" }],
]);
/**
 * @license lucide-vue-next v0.309.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const Re = M("VideoIcon", [
		["path", { d: "m22 8-6 4 6 4V8Z", key: "50v9me" }],
		[
			"rect",
			{
				width: "14",
				height: "12",
				x: "2",
				y: "6",
				rx: "2",
				ry: "2",
				key: "1rqjg6",
			},
		],
	]),
	He = { class: "flex flex-col gap-4" },
	Oe = { class: "mb-1.5 text-sm text-gray-600" },
	Fe = { class: "mb-1.5 text-sm text-gray-600" },
	Ze = { key: 0 },
	Je = { class: "mb-1.5 text-sm text-gray-600" },
	Ge = { class: "grid grid-cols-2 gap-2" },
	Ke = ["onClick"],
	Qe = {
		__name: "EvaluationModal",
		props: z(
			{
				courses: { type: Array, default: [] },
				batch: { type: String, default: null },
				endDate: { type: String, default: null },
			},
			{
				modelValue: {},
				modelModifiers: {},
				reloadEvals: {},
				reloadEvalsModifiers: {},
			}
		),
		emits: ["update:modelValue", "update:reloadEvals"],
		setup(m) {
			const b = C("$user"),
				o = C("$dayjs"),
				p = j(m, "modelValue"),
				g = j(m, "reloadEvals"),
				l = m;
			let s = F({
				course: "",
				date: "",
				start_time: "",
				end_time: "",
				day: "",
				batch: l.batch,
				member: b.data.name,
			});
			const _ = S({
				url: "frappe.client.insert",
				makeParams(n) {
					return {
						doc: q(
							{
								doctype: "LMS Certificate Request",
								batch_name: n.batch,
							},
							n
						),
					};
				},
			});
			function c(n) {
				_.submit(s, {
					validate() {
						if (!s.course) return "Please select a course.";
						if (!s.date) return "Please select a date.";
						if (!s.start_time) return "Please select a slot.";
						if (o(s.date).isSameOrBefore(o(), "day"))
							return "Please select a future date.";
						if (o(s.date).isAfter(o(l.endDate), "day"))
							return `Please select a date before the end date ${o(
								l.endDate
							).format("DD MMMM YYYY")}.`;
					},
					onSuccess() {
						g.value.reload(), n();
					},
					onError(a) {
						var r;
						Y({
							title: "Error",
							text:
								((r = a.messages) == null ? void 0 : r[0]) || a,
							icon: "x",
							iconClasses:
								"bg-red-600 text-white rounded-md p-px",
							position: "top-center",
							timeout: 10,
						});
					},
				});
			}
			const y = () => {
					let n = [];
					for (const a of l.courses)
						n.push({ label: a.title, value: a.course });
					return n;
				},
				v = S({
					url: "lms.lms.doctype.course_evaluator.course_evaluator.get_schedule",
					makeParams(n) {
						return {
							course: n.course,
							date: n.date,
							batch: l.batch,
						};
					},
				});
			se(
				() => s.date,
				(n) => {
					(s.start_time = ""), n && v.submit(s);
				}
			),
				se(
					() => s.course,
					(n) => {
						(s.date = ""), (s.start_time = ""), v.reset();
					}
				);
			const k = (n) => {
				(s.start_time = n.start_time),
					(s.end_time = n.end_time),
					(s.day = n.day);
			};
			return (n, a) => (
				i(),
				$(
					e(I),
					{
						modelValue: p.value,
						"onUpdate:modelValue":
							a[2] || (a[2] = (r) => (p.value = r)),
						options: {
							title: n.__("Schedule Evaluation"),
							size: "xl",
							actions: [
								{
									label: n.__("Submit"),
									variant: "solid",
									onClick: (r) => c(r),
								},
							],
						},
					},
					{
						"body-content": f(() => [
							t("div", He, [
								t("div", null, [
									t("div", Oe, u(n.__("Course")), 1),
									d(
										e(H),
										{
											modelValue: e(s).course,
											"onUpdate:modelValue":
												a[0] ||
												(a[0] = (r) =>
													(e(s).course = r)),
											options: y(),
										},
										null,
										8,
										["modelValue", "options"]
									),
								]),
								t("div", null, [
									t("div", Fe, u(n.__("Date")), 1),
									d(
										e(le),
										{
											modelValue: e(s).date,
											"onUpdate:modelValue":
												a[1] ||
												(a[1] = (r) => (e(s).date = r)),
										},
										null,
										8,
										["modelValue"]
									),
								]),
								e(v).data
									? (i(),
									  h("div", Ze, [
											t(
												"div",
												Je,
												u(n.__("Select a slot")),
												1
											),
											t("div", Ge, [
												(i(!0),
												h(
													w,
													null,
													A(
														e(v).data,
														(r) => (
															i(),
															h("div", null, [
																t(
																	"div",
																	{
																		class: O(
																			[
																				"text-base text-center border rounded-md bg-gray-200 p-2 cursor-pointer",
																				{
																					"border-gray-900":
																						e(
																							s
																						)
																							.start_time ==
																						r.start_time,
																				},
																			]
																		),
																		onClick:
																			(
																				T
																			) =>
																				k(
																					r
																				),
																	},
																	u(
																		e(E)(
																			r.start_time
																		)
																	) +
																		" - " +
																		u(
																			e(
																				E
																			)(
																				r.end_time
																			)
																		),
																	11,
																	Ke
																),
															])
														)
													),
													256
												)),
											]),
									  ]))
									: V("", !0),
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
	We = { class: "mb-10" },
	Xe = { class: "text-lg font-semibold mb-4" },
	et = { key: 1 },
	tt = { class: "grid grid-cols-2 gap-4" },
	st = { class: "border rounded-md p-3" },
	at = { class: "font-semibold mb-3" },
	ot = { class: "flex items-center mb-2" },
	lt = { class: "ml-2" },
	nt = { class: "flex items-center mb-2" },
	it = { class: "ml-2" },
	dt = { class: "flex items-center" },
	rt = { class: "ml-2 font-medium" },
	ut = { key: 2, class: "text-sm italic text-gray-600" },
	ct = {
		__name: "UpcomingEvaluations",
		props: {
			batch: { type: String, default: null },
			courses: { type: Array, default: [] },
			isStudent: { type: Boolean, default: !1 },
			endDate: { type: String, default: null },
		},
		setup(m) {
			const b = C("$dayjs"),
				o = C("$user"),
				p = B(!1),
				g = m,
				l = S({
					url: "lms.lms.utils.get_upcoming_evals",
					cache: ["upcoming_evals", o.data.name],
					params: {
						student: o.data.name,
						courses: g.courses.map((_) => _.course),
					},
					auto: !0,
				});
			function s() {
				p.value = !0;
			}
			return (_, c) => {
				var y;
				return (
					i(),
					h(
						w,
						null,
						[
							t("div", We, [
								m.isStudent
									? (i(),
									  $(
											e(D),
											{
												key: 0,
												onClick: s,
												class: "float-right",
											},
											{
												default: f(() => [
													L(
														u(
															_.__(
																"Schedule Evaluation"
															)
														),
														1
													),
												]),
												_: 1,
											}
									  ))
									: V("", !0),
								t(
									"div",
									Xe,
									u(_.__("Upcoming Evaluations")),
									1
								),
								(y = e(l).data) != null && y.length
									? (i(),
									  h("div", et, [
											t("div", tt, [
												(i(!0),
												h(
													w,
													null,
													A(
														e(l).data,
														(v) => (
															i(),
															h("div", null, [
																t("div", st, [
																	t(
																		"div",
																		at,
																		u(
																			v.course_title
																		),
																		1
																	),
																	t(
																		"div",
																		ot,
																		[
																			d(
																				e(
																					J
																				),
																				{
																					class: "w-4 h-4 stroke-1.5",
																				}
																			),
																			t(
																				"span",
																				lt,
																				u(
																					e(
																						b
																					)(
																						v.date
																					).format(
																						"DD MMMM YYYY"
																					)
																				),
																				1
																			),
																		]
																	),
																	t(
																		"div",
																		nt,
																		[
																			d(
																				e(
																					G
																				),
																				{
																					class: "w-4 h-4 stroke-1.5",
																				}
																			),
																			t(
																				"span",
																				it,
																				u(
																					e(
																						E
																					)(
																						v.start_time
																					)
																				),
																				1
																			),
																		]
																	),
																	t(
																		"div",
																		dt,
																		[
																			d(
																				e(
																					qe
																				),
																				{
																					class: "w-4 h-4 stroke-1.5",
																				}
																			),
																			t(
																				"span",
																				rt,
																				u(
																					v.evaluator_name
																				),
																				1
																			),
																		]
																	),
																]),
															])
														)
													),
													256
												)),
											]),
									  ]))
									: (i(),
									  h(
											"div",
											ut,
											u(_.__("No upcoming evaluations.")),
											1
									  )),
							]),
							d(
								Qe,
								{
									batch: m.batch,
									endDate: m.endDate,
									courses: m.courses,
									modelValue: p.value,
									"onUpdate:modelValue":
										c[0] || (c[0] = (v) => (p.value = v)),
									reloadEvals: e(l),
									"onUpdate:reloadEvals":
										c[1] ||
										(c[1] = (v) =>
											Z(l) ? (l.value = v) : null),
								},
								null,
								8,
								[
									"batch",
									"endDate",
									"courses",
									"modelValue",
									"reloadEvals",
								]
							),
						],
						64
					)
				);
			};
		},
	},
	mt = { class: "text-lg font-semibold mb-4" },
	_t = { key: 0 },
	pt = { key: 1, class: "text-sm italic text-gray-600" },
	ce = {
		__name: "Assessments",
		props: {
			batch: { type: String, required: !0 },
			rows: { type: Array },
			columns: { type: Array },
			options: {
				type: Object,
				default: () => ({ selectable: !0, totalCount: 0, rowCount: 0 }),
			},
		},
		setup(m) {
			const b = C("$user"),
				p = S({
					url: "lms.lms.utils.get_assessments",
					params: { batch: m.batch },
					auto: !0,
				}),
				g = () => {
					var s;
					let l = [
						{ label: "Assessment", key: "title" },
						{ label: "Type", key: "assessment_type" },
					];
					return (
						((s = b.data) != null && s.is_moderator) ||
							l.push({
								label: "Status/Score",
								key: "status",
								align: "center",
							}),
						l
					);
				};
			return (l, s) => {
				var _;
				return (
					i(),
					h("div", null, [
						t("div", mt, u(l.__("Assessments")), 1),
						(_ = e(p).data) != null && _.length
							? (i(),
							  h("div", _t, [
									d(
										e(ne),
										{
											columns: g(),
											rows: e(p).data,
											"row-key": "name",
											options: {
												selectable: !1,
												showTooltip: !1,
											},
										},
										null,
										8,
										["columns", "rows"]
									),
							  ]))
							: (i(), h("div", pt, u(l.__("No Assessments")), 1)),
					])
				);
			};
		},
	},
	ht = {
		__name: "BatchDashboard",
		props: {
			batch: { type: Object, default: null },
			isStudent: { type: Boolean, default: !1 },
		},
		setup(m) {
			return (b, o) => (
				i(),
				h("div", null, [
					d(
						ct,
						{
							batch: m.batch.data.name,
							endDate: m.batch.data.evaluation_end_date,
							courses: m.batch.data.courses,
							isStudent: m.isStudent,
						},
						null,
						8,
						["batch", "endDate", "courses", "isStudent"]
					),
					d(ce, { batch: m.batch.data.name }, null, 8, ["batch"]),
				])
			);
		},
	},
	bt = { class: "flex flex-col gap-4" },
	yt = { class: "grid grid-cols-2 gap-4" },
	vt = { class: "mb-4" },
	ft = { class: "mb-1.5 text-sm text-gray-600" },
	gt = { class: "mb-4" },
	kt = { class: "mb-1.5 text-sm text-gray-600" },
	xt = { class: "mb-1.5 text-sm text-gray-600" },
	$t = { class: "mb-4" },
	Vt = { class: "mb-1.5 text-sm text-gray-600" },
	Ct = { class: "mb-4" },
	St = { class: "mb-1.5 text-sm text-gray-600" },
	Mt = { class: "mb-1.5 text-sm text-gray-600" },
	wt = { class: "mb-1.5 text-sm text-gray-600" },
	Lt = {
		__name: "LiveClassModal",
		props: z(
			{ batch: { type: String, default: null } },
			{
				reloadLiveClasses: {},
				reloadLiveClassesModifiers: {},
				modelValue: {},
				modelModifiers: {},
			}
		),
		emits: ["update:reloadLiveClasses", "update:modelValue"],
		setup(m) {
			const b = j(m, "reloadLiveClasses"),
				o = j(m, "modelValue"),
				p = C("$user"),
				g = C("$dayjs");
			let s = F({
				title: "",
				description: "",
				date: "",
				time: "",
				duration: "",
				timezone: "",
				auto_recording: "No Recording",
				batch: m.batch,
				host: p.data.name,
			});
			const _ = () => Me().map((n) => ({ label: n, value: n })),
				c = () => [
					{ label: "No Recording", value: "No Recording" },
					{ label: "Local", value: "Local" },
					{ label: "Cloud", value: "Cloud" },
				],
				y = S({
					url: "lms.lms.doctype.lms_batch.lms_batch.create_live_class",
					makeParams(n) {
						return q(
							{ doctype: "LMS Live Class", batch_name: n.batch },
							n
						);
					},
				}),
				v = (n) => {
					y.submit(s, {
						validate() {
							if (!s.title) return "Please enter a title.";
							if (!s.date) return "Please select a date.";
							if (g(s.date).isSameOrBefore(g(), "day"))
								return "Please select a future date.";
							if (!s.time) return "Please select a time.";
							if (!k())
								return "Please enter a valid time in the format HH:mm.";
							if (!s.duration) return "Please select a duration.";
							if (!s.timezone) return "Please select a timezone.";
						},
						onSuccess() {
							b.value.reload(), n();
						},
						onError(a) {
							var r;
							Y({
								title: "Error",
								text:
									((r = a.messages) == null
										? void 0
										: r[0]) || a,
								icon: "x",
								iconClasses:
									"bg-red-600 text-white rounded-md p-px",
								position: "top-center",
								timeout: 10,
							});
						},
					});
				},
				k = () => {
					let n = s.time.split(":");
					return !(
						n.length != 2 ||
						n[0] < 0 ||
						n[0] > 23 ||
						n[1] < 0 ||
						n[1] > 59
					);
				};
			return (n, a) => (
				i(),
				$(
					e(I),
					{
						modelValue: o.value,
						"onUpdate:modelValue":
							a[7] || (a[7] = (r) => (o.value = r)),
						options: {
							title: n.__("Create a Live Class"),
							size: "xl",
							actions: [
								{
									label: "Submit",
									variant: "solid",
									onClick: (r) => v(r),
								},
							],
						},
					},
					{
						"body-content": f(() => [
							t("div", bt, [
								t("div", yt, [
									t("div", null, [
										t("div", vt, [
											t("div", ft, u(n.__("Title")), 1),
											d(
												e(P),
												{
													type: "text",
													modelValue: e(s).title,
													"onUpdate:modelValue":
														a[0] ||
														(a[0] = (r) =>
															(e(s).title = r)),
												},
												null,
												8,
												["modelValue"]
											),
										]),
										t("div", gt, [
											t("div", kt, [
												d(
													e(ae),
													{
														class: "flex items-center",
														text: n.__(
															"Time must be in 24 hour format (HH:mm). Example 11:30 or 22:00"
														),
													},
													{
														default: f(() => [
															t(
																"span",
																null,
																u(n.__("Time")),
																1
															),
															d(e(oe), {
																class: "stroke-2 w-3 h-3 ml-1",
															}),
														]),
														_: 1,
													},
													8,
													["text"]
												),
											]),
											d(
												e(P),
												{
													modelValue: e(s).time,
													"onUpdate:modelValue":
														a[1] ||
														(a[1] = (r) =>
															(e(s).time = r)),
												},
												null,
												8,
												["modelValue"]
											),
										]),
										t("div", null, [
											t(
												"div",
												xt,
												u(n.__("Timezone")),
												1
											),
											d(
												e(H),
												{
													modelValue: e(s).timezone,
													"onUpdate:modelValue":
														a[2] ||
														(a[2] = (r) =>
															(e(s).timezone =
																r)),
													options: _(),
												},
												null,
												8,
												["modelValue", "options"]
											),
										]),
									]),
									t("div", null, [
										t("div", $t, [
											t("div", Vt, u(n.__("Date")), 1),
											d(
												e(le),
												{
													modelValue: e(s).date,
													"onUpdate:modelValue":
														a[3] ||
														(a[3] = (r) =>
															(e(s).date = r)),
													inputClass: "w-full",
												},
												null,
												8,
												["modelValue"]
											),
										]),
										t("div", Ct, [
											t("div", St, [
												d(
													e(ae),
													{
														class: "flex items-center",
														text: n.__(
															"Duration of the live class in minutes"
														),
													},
													{
														default: f(() => [
															t(
																"span",
																null,
																u(
																	n.__(
																		"Duration"
																	)
																),
																1
															),
															d(e(oe), {
																class: "stroke-2 w-3 h-3 ml-1",
															}),
														]),
														_: 1,
													},
													8,
													["text"]
												),
											]),
											d(
												e(P),
												{
													type: "number",
													modelValue: e(s).duration,
													"onUpdate:modelValue":
														a[4] ||
														(a[4] = (r) =>
															(e(s).duration =
																r)),
												},
												null,
												8,
												["modelValue"]
											),
										]),
										t("div", null, [
											t(
												"div",
												Mt,
												u(n.__("Auto Recording")),
												1
											),
											d(
												e(H),
												{
													modelValue:
														e(s).auto_recording,
													"onUpdate:modelValue":
														a[5] ||
														(a[5] = (r) =>
															(e(
																s
															).auto_recording =
																r)),
													options: c(),
												},
												null,
												8,
												["modelValue", "options"]
											),
										]),
									]),
								]),
								t("div", null, [
									t("div", wt, u(n.__("Description")), 1),
									d(
										e(he),
										{
											modelValue: e(s).description,
											"onUpdate:modelValue":
												a[6] ||
												(a[6] = (r) =>
													(e(s).description = r)),
										},
										null,
										8,
										["modelValue"]
									),
								]),
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
	Dt = { class: "text-lg font-semibold mb-4" },
	jt = { key: 1, class: "grid grid-cols-2 gap-5" },
	At = { class: "border rounded-md p-3" },
	Tt = { class: "font-semibold text-lg mb-4" },
	Ut = { class: "flex items-center mb-2" },
	Bt = { class: "ml-2" },
	Et = { class: "flex items-center mb-5" },
	Nt = { class: "ml-2" },
	Pt = { class: "mb-5" },
	Yt = { class: "flex items-center gap-2" },
	zt = ["href"],
	It = ["href"],
	qt = { key: 2, class: "text-sm italic text-gray-600" },
	Rt = {
		__name: "LiveClass",
		props: { batch: { type: String, required: !0 } },
		setup(m) {
			const b = C("$user"),
				o = B(!1),
				p = C("$dayjs"),
				g = m,
				l = ie({
					doctype: "LMS Live Class",
					filters: { batch: g.batchName, date: [">=", new Date()] },
					fields: [
						"title",
						"description",
						"time",
						"date",
						"start_url",
						"join_url",
						"owner",
					],
					orderBy: "date",
					auto: !0,
				}),
				s = () => {
					o.value = !0;
				};
			return (_, c) => {
				var y;
				return (
					i(),
					h(
						w,
						null,
						[
							e(b).data.is_moderator
								? (i(),
								  $(
										e(D),
										{
											key: 0,
											variant: "solid",
											class: "float-right mb-3",
											onClick: s,
										},
										{
											prefix: f(() => [
												d(e(ue), { class: "h-4 w-4" }),
											]),
											default: f(() => [
												t(
													"span",
													null,
													u(_.__("Create")),
													1
												),
											]),
											_: 1,
										}
								  ))
								: V("", !0),
							t("div", Dt, u(_.__("Live Class")), 1),
							(y = e(l).data) != null && y.length
								? (i(),
								  h("div", jt, [
										(i(!0),
										h(
											w,
											null,
											A(
												e(l).data,
												(v) => (
													i(),
													h("div", null, [
														t("div", At, [
															t(
																"div",
																Tt,
																u(v.title),
																1
															),
															t("div", Ut, [
																d(e(J), {
																	class: "w-4 h-4 stroke-1.5",
																}),
																t(
																	"span",
																	Bt,
																	u(
																		e(p)(
																			v.date
																		).format(
																			"DD MMMM YYYY"
																		)
																	),
																	1
																),
															]),
															t("div", Et, [
																d(e(G), {
																	class: "w-4 h-4 stroke-1.5",
																}),
																t(
																	"span",
																	Nt,
																	u(
																		e(E)(
																			v.time
																		)
																	),
																	1
																),
															]),
															t(
																"div",
																Pt,
																u(
																	v.description
																),
																1
															),
															t("div", Yt, [
																t(
																	"a",
																	{
																		href: v.start_url,
																		target: "_blank",
																		class: "w-1/2 cursor-pointer inline-flex items-center justify-center gap-2 transition-colors focus:outline-none text-gray-800 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 focus-visible:ring focus-visible:ring-gray-400 h-7 text-base px-2 rounded",
																	},
																	[
																		d(
																			e(
																				Ye
																			),
																			{
																				class: "h-4 w-4 stroke-1.5",
																			}
																		),
																		L(
																			" " +
																				u(
																					_.__(
																						"Start"
																					)
																				),
																			1
																		),
																	],
																	8,
																	zt
																),
																t(
																	"a",
																	{
																		href: v.join_url,
																		target: "_blank",
																		class: "w-1/2 cursor-pointer inline-flex items-center justify-center gap-2 transition-colors focus:outline-none text-gray-800 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 focus-visible:ring focus-visible:ring-gray-400 h-7 text-base px-2 rounded",
																	},
																	[
																		d(
																			e(
																				Re
																			),
																			{
																				class: "h-4 w-4 stroke-1.5",
																			}
																		),
																		L(
																			" " +
																				u(
																					_.__(
																						"Join"
																					)
																				),
																			1
																		),
																	],
																	8,
																	It
																),
															]),
														]),
													])
												)
											),
											256
										)),
								  ]))
								: (i(),
								  h(
										"div",
										qt,
										u(_.__("No live classes scheduled")),
										1
								  )),
							d(
								Lt,
								{
									batch: g.batch,
									modelValue: o.value,
									"onUpdate:modelValue":
										c[0] || (c[0] = (v) => (o.value = v)),
									reloadLiveClasses: e(l),
									"onUpdate:reloadLiveClasses":
										c[1] ||
										(c[1] = (v) =>
											Z(l) ? (l.value = v) : null),
								},
								null,
								8,
								["batch", "modelValue", "reloadLiveClasses"]
							),
						],
						64
					)
				);
			};
		},
	},
	Ht = { class: "flex flex-col gap-4" },
	Ot = {
		__name: "StudentModal",
		props: z(
			{ batch: { type: String, default: null } },
			{
				reloadStudents: {},
				reloadStudentsModifiers: {},
				modelValue: {},
				modelModifiers: {},
			}
		),
		emits: ["update:reloadStudents", "update:modelValue"],
		setup(m) {
			const b = j(m, "reloadStudents"),
				o = B(),
				p = j(m, "modelValue"),
				g = m,
				l = S({
					url: "frappe.client.insert",
					makeParams(_) {
						return {
							doc: {
								doctype: "Batch Student",
								parent: g.batch,
								parenttype: "LMS Batch",
								parentfield: "students",
								student: o.value,
							},
						};
					},
				}),
				s = (_) => {
					l.submit(
						{},
						{
							onSuccess() {
								b.value.reload(), _(), (o.value = null);
							},
						}
					);
				};
			return (_, c) => (
				i(),
				$(
					e(I),
					{
						modelValue: p.value,
						"onUpdate:modelValue":
							c[1] || (c[1] = (y) => (p.value = y)),
						options: {
							title: _.__("Add a Student"),
							size: "xl",
							actions: [
								{
									label: "Submit",
									variant: "solid",
									onClick: (y) => s(y),
								},
							],
						},
					},
					{
						"body-content": f(() => [
							t("div", Ht, [
								d(
									je,
									{
										doctype: "User",
										modelValue: o.value,
										"onUpdate:modelValue":
											c[0] ||
											(c[0] = (y) => (o.value = y)),
										filters: { ignore_user_type: 1 },
									},
									null,
									8,
									["modelValue"]
								),
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
	Ft = { class: "text-lg font-semibold mb-4" },
	Zt = { key: 0 },
	Jt = { key: 0 },
	Gt = { class: "flex gap-2" },
	Kt = {
		__name: "BatchStudents",
		props: { batch: { type: String, default: null } },
		setup(m) {
			const b = B(!1),
				o = m,
				p = S({
					url: "lms.lms.utils.get_batch_students",
					cache: ["students", o.batch],
					params: { batch: o.batch },
					auto: !0,
				}),
				g = () => [
					{ label: "Full Name", key: "full_name" },
					{
						label: "Courses Done",
						key: "courses_completed",
						align: "center",
					},
					{
						label: "Assessments Done",
						key: "assessments_completed",
						align: "center",
					},
					{ label: "Last Active", key: "last_active" },
				],
				l = () => {
					b.value = !0;
				},
				s = S({
					url: "frappe.client.delete",
					makeParams(c) {
						return { doctype: "Batch Student", name: c.student };
					},
				}),
				_ = (c) => {
					c.forEach((y) =>
						te(this, null, function* () {
							console.log(y),
								s.submit({ student: y }),
								yield setTimeout(1e3);
						})
					);
				};
			return (c, y) => {
				var v;
				return (
					i(),
					h(
						w,
						null,
						[
							d(
								e(D),
								{
									class: "float-right mb-3",
									variant: "solid",
									onClick: y[0] || (y[0] = (k) => l()),
								},
								{
									prefix: f(() => [
										d(e(ue), { class: "h-4 w-4" }),
									]),
									default: f(() => [
										L(" " + u(c.__("Add Student")), 1),
									]),
									_: 1,
								}
							),
							t("div", Ft, u(c.__("Students")), 1),
							(v = e(p).data) != null && v.length
								? (i(),
								  h("div", Zt, [
										d(
											e(ne),
											{
												columns: g(),
												rows: e(p).data,
												"row-key": "name",
												options: { showTooltip: !1 },
											},
											{
												default: f(() => [
													d(
														e(be),
														{
															class: "mb-2 grid items-center space-x-4 rounded bg-gray-100 p-2",
														},
														{
															default: f(() => [
																(i(!0),
																h(
																	w,
																	null,
																	A(
																		g(),
																		(k) => (
																			i(),
																			$(
																				e(
																					ye
																				),
																				{
																					item: k,
																				},
																				{
																					prefix: f(
																						({
																							item: n,
																						}) => [
																							n.icon
																								? (i(),
																								  $(
																										de(
																											n.icon
																										),
																										{
																											key: 0,
																											class: "h-4 w-4 stroke-1.5 ml-4",
																										}
																								  ))
																								: V(
																										"",
																										!0
																								  ),
																						]
																					),
																					_: 2,
																				},
																				1032,
																				[
																					"item",
																				]
																			)
																		)
																	),
																	256
																)),
															]),
															_: 1,
														}
													),
													d(e(ve), null, {
														default: f(() => [
															(i(!0),
															h(
																w,
																null,
																A(
																	e(p).data,
																	(k) => (
																		i(),
																		$(
																			e(
																				fe
																			),
																			{
																				row: k,
																			},
																			{
																				default:
																					f(
																						({
																							column: n,
																							item: a,
																						}) => [
																							d(
																								e(
																									ge
																								),
																								{
																									item: k[
																										n
																											.key
																									],
																									align: n.align,
																								},
																								{
																									prefix: f(
																										() => [
																											n.key ==
																											"full_name"
																												? (i(),
																												  h(
																														"div",
																														Jt,
																														[
																															d(
																																e(
																																	re
																																),
																																{
																																	class: "flex items-center",
																																	image: k.user_image,
																																	label: a,
																																	size: "sm",
																																},
																																null,
																																8,
																																[
																																	"image",
																																	"label",
																																]
																															),
																														]
																												  ))
																												: V(
																														"",
																														!0
																												  ),
																										]
																									),
																									default:
																										f(
																											() => [
																												t(
																													"div",
																													null,
																													u(
																														k[
																															n
																																.key
																														]
																													),
																													1
																												),
																											]
																										),
																									_: 2,
																								},
																								1032,
																								[
																									"item",
																									"align",
																								]
																							),
																						]
																					),
																				_: 2,
																			},
																			1032,
																			[
																				"row",
																			]
																		)
																	)
																),
																256
															)),
														]),
														_: 1,
													}),
													d(e(ke), null, {
														actions: f(
															({
																unselectAll: k,
																selections: n,
															}) => [
																t("div", Gt, [
																	d(
																		e(D),
																		{
																			variant:
																				"ghost",
																			onClick:
																				(
																					a
																				) =>
																					_(
																						n
																					),
																		},
																		{
																			default:
																				f(
																					() => [
																						d(
																							e(
																								Ie
																							),
																							{
																								class: "h-4 w-4 stroke-1.5",
																							}
																						),
																					]
																				),
																			_: 2,
																		},
																		1032,
																		[
																			"onClick",
																		]
																	),
																	d(
																		e(D),
																		{
																			variant:
																				"ghost",
																			label: "Unselect all",
																			onClick:
																				(
																					a
																				) =>
																					k.toString(),
																		},
																		null,
																		8,
																		[
																			"onClick",
																		]
																	),
																]),
															]
														),
														_: 1,
													}),
												]),
												_: 1,
											},
											8,
											["columns", "rows"]
										),
								  ]))
								: V("", !0),
							d(
								Ot,
								{
									batch: o.batch,
									modelValue: b.value,
									"onUpdate:modelValue":
										y[1] || (y[1] = (k) => (b.value = k)),
									reloadStudents: e(p),
									"onUpdate:reloadStudents":
										y[2] ||
										(y[2] = (k) =>
											Z(p) ? (p.value = k) : null),
								},
								null,
								8,
								["batch", "modelValue", "reloadStudents"]
							),
						],
						64
					)
				);
			};
		},
	},
	Qt = { key: 0 },
	Wt = { class: "mb-8" },
	Xt = { class: "flex items-center justify-between mb-2" },
	es = { class: "flex items-center" },
	ts = { class: "ml-2" },
	ss = { class: "text-sm" },
	as = ["innerHTML"],
	os = { key: 1, class: "text-sm italic text-gray-600" },
	ls = {
		__name: "Annoucements",
		props: { batch: { type: String, required: !0 } },
		setup(m) {
			const b = m,
				o = ie({
					doctype: "Communication",
					fields: [
						"subject",
						"content",
						"recipients",
						"cc",
						"communication_date",
						"sender",
						"sender_full_name",
					],
					filters: {
						reference_doctype: "LMS Batch",
						reference_name: b.batch,
					},
					orderBy: "communication_date desc",
					auto: !0,
					cache: ["batch", b.batch],
				});
			return (p, g) => {
				var l;
				return (l = e(o).data) != null && l.length
					? (i(),
					  h("div", Qt, [
							(i(!0),
							h(
								w,
								null,
								A(
									e(o).data,
									(s) => (
										i(),
										h("div", null, [
											t("div", Wt, [
												t("div", Xt, [
													t("div", es, [
														d(
															e(re),
															{
																label: s.sender_full_name,
																size: "lg",
															},
															null,
															8,
															["label"]
														),
														t(
															"div",
															ts,
															u(
																s.sender_full_name
															),
															1
														),
													]),
													t(
														"div",
														ss,
														u(
															e(we)(
																s.communication_date
															)
														),
														1
													),
												]),
												t(
													"div",
													{
														class: "prose prose-sm bg-gray-50 !min-w-full px-4 py-2 rounded-md",
														innerHTML: s.content,
													},
													null,
													8,
													as
												),
											]),
										])
									)
								),
								256
							)),
					  ]))
					: (i(), h("div", os, u(p.__("No announcements")), 1));
			};
		},
	},
	ns = { class: "flex flex-col gap-4" },
	is = { class: "" },
	ds = { class: "mb-1.5 text-sm text-gray-600" },
	rs = { class: "" },
	us = { class: "mb-1.5 text-sm text-gray-600" },
	cs = { class: "mb-4" },
	ms = { class: "mb-1.5 text-sm text-gray-600" },
	_s = {
		__name: "AnnouncementModal",
		props: z(
			{
				batch: { type: String, required: !0 },
				students: { type: Array, required: !0 },
			},
			{ modelValue: {}, modelModifiers: {} }
		),
		emits: ["update:modelValue"],
		setup(m) {
			const b = j(m, "modelValue"),
				o = m,
				p = F({ subject: "", replyTo: "", announcement: "" }),
				g = S({
					url: "frappe.core.doctype.communication.email.make",
					makeParams(s) {
						return {
							recipients: o.students.join(", "),
							cc: p.replyTo,
							subject: p.subject,
							content: p.announcement,
							doctype: "LMS Batch",
							name: o.batch,
							send_email: 1,
						};
					},
				}),
				l = (s) => {
					g.submit(
						{},
						{
							validate() {
								if (!o.students.length)
									return "No students in this batch";
								if (!p.subject) return "Subject is required";
							},
							onSuccess() {
								s(),
									Y({
										title: "Success",
										text: "Announcement has been sent successfully",
										icon: "Check",
										iconClasses:
											"bg-green-600 text-white rounded-md p-px",
									});
							},
							onError(_) {
								var c;
								Y({
									title: "Error",
									text:
										((c = _.messages) == null
											? void 0
											: c[0]) || _,
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
			return (s, _) => (
				i(),
				$(
					e(I),
					{
						modelValue: b.value,
						"onUpdate:modelValue":
							_[3] || (_[3] = (c) => (b.value = c)),
						options: {
							title: s.__("Make an Announcement"),
							size: "xl",
							actions: [
								{
									label: "Submit",
									variant: "solid",
									onClick: (c) => l(c),
								},
							],
						},
					},
					{
						"body-content": f(() => [
							t("div", ns, [
								t("div", is, [
									t("div", ds, u(s.__("Subject")), 1),
									d(
										e(P),
										{
											type: "text",
											modelValue: p.subject,
											"onUpdate:modelValue":
												_[0] ||
												(_[0] = (c) => (p.subject = c)),
										},
										null,
										8,
										["modelValue"]
									),
								]),
								t("div", rs, [
									t("div", us, u(s.__("Reply To")), 1),
									d(
										e(P),
										{
											type: "text",
											modelValue: p.replyTo,
											"onUpdate:modelValue":
												_[1] ||
												(_[1] = (c) => (p.replyTo = c)),
										},
										null,
										8,
										["modelValue"]
									),
								]),
								t("div", cs, [
									t("div", ms, u(s.__("Announcement")), 1),
									d(e(xe), {
										bubbleMenu: !0,
										onChange:
											_[2] ||
											(_[2] = (c) =>
												(p.announcement = c)),
										editorClass:
											"prose-sm py-2 px-2 min-h-[200px] border-gray-300 hover:border-gray-400 rounded-md bg-gray-200",
									}),
								]),
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
	ps = { key: 0, class: "h-screen text-base" },
	hs = {
		class: "sticky top-0 z-10 flex items-center justify-between border-b bg-white px-3 py-2.5 sm:px-5",
	},
	bs = { key: 0, class: "grid grid-cols-[70%,30%] h-full" },
	ys = { class: "border-r-2" },
	vs = { class: "pt-5 px-10 pb-10" },
	fs = { key: 0 },
	gs = { class: "text-xl font-semibold" },
	ks = { class: "grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 gap-8 mt-5" },
	xs = { key: 1 },
	$s = { key: 2 },
	Vs = { key: 3 },
	Cs = { key: 4 },
	Ss = { key: 5 },
	Ms = { key: 6 },
	ws = { class: "p-5" },
	Ls = { class: "text-2xl font-semibold mb-3" },
	Ds = { class: "flex items-center mb-3" },
	js = { class: "flex items-center mb-6" },
	As = ["innerHTML"],
	Ts = { key: 1, class: "h-screen" },
	Us = { class: "text-base border rounded-md w-1/3 mx-auto my-32" },
	Bs = { class: "border-b px-5 py-3 font-medium" },
	Es = t(
		"span",
		{
			class: "inline-flex items-center before:bg-red-600 before:w-2 before:h-2 before:rounded-md before:mr-2",
		},
		null,
		-1
	),
	Ns = { class: "px-5 py-3" },
	Ps = { key: 0, class: "mb-4 leading-6" },
	Ys = { key: 1, class: "mb-4 leading-6" },
	Qs = {
		__name: "Batch",
		props: { batchName: { type: String, required: !0 } },
		setup(m) {
			const b = C("$dayjs"),
				o = C("$user"),
				p = B(!1),
				g = m,
				l = S({
					url: "lms.lms.utils.get_batch_details",
					cache: ["batch", g.batchName],
					params: { batch: g.batchName },
					auto: !0,
				}),
				s = R(() => {
					var r, T, N;
					let a = [
						{ label: "All Batches", route: { name: "Batches" } },
					];
					return (
						_.value ||
							a.push({
								label: (r = l.data) == null ? void 0 : r.title,
								route: {
									name: "BatchDetail",
									params: {
										batchName:
											(T = l.data) == null
												? void 0
												: T.name,
									},
								},
							}),
						a.push({
							label:
								(N = l == null ? void 0 : l.data) == null
									? void 0
									: N.title,
							route: {
								name: "Batch",
								params: { batchName: g.batchName },
							},
						}),
						a
					);
				}),
				_ = R(() => {
					var a, r;
					return (
						(o == null ? void 0 : o.data) &&
						((a = l.data) == null ? void 0 : a.students.length) &&
						((r = l.data) == null
							? void 0
							: r.students.includes(o.data.name))
					);
				}),
				c = B(0),
				y = R(() => {
					var r;
					let a = [];
					return (
						_.value && a.push({ label: "Dashboard", icon: Ee }),
						(r = o.data) != null &&
							r.is_moderator &&
							(a.push({ label: "Students", icon: Ue }),
							a.push({ label: "Assessments", icon: Te })),
						a.push({ label: "Live Class", icon: Be }),
						a.push({ label: "Courses", icon: Le }),
						a.push({ label: "Announcements", icon: Ne }),
						a.push({ label: "Discussions", icon: Pe }),
						a
					);
				}),
				v = S({
					url: "lms.lms.utils.get_batch_courses",
					params: { batch: g.batchName },
					cache: ["batchCourses", g.batchName],
					auto: !0,
				}),
				k = () => {
					window.location.href = "/login?redirect-to=/batches";
				},
				n = () => {
					p.value = !0;
				};
			return (a, r) => {
				var N, K, Q, W;
				const T = $e("router-link");
				return ((N = e(o).data) != null && N.is_moderator) || _.value
					? (i(),
					  h("div", ps, [
							t("header", hs, [
								d(
									e(Ve),
									{ class: "h-7", items: s.value },
									null,
									8,
									["items"]
								),
								(K = e(o).data) != null && K.is_moderator
									? (i(),
									  $(
											e(D),
											{
												key: 0,
												onClick:
													r[0] || (r[0] = (x) => n()),
											},
											{
												suffix: f(() => [
													d(e(ze), {
														class: "h-4 stroke-1.5",
													}),
												]),
												default: f(() => [
													t(
														"span",
														null,
														u(
															a.__(
																"Make an Announcement"
															)
														),
														1
													),
												]),
												_: 1,
											}
									  ))
									: V("", !0),
							]),
							e(l).data
								? (i(),
								  h("div", bs, [
										t("div", ys, [
											d(
												e(Se),
												{
													class: "overflow-hidden",
													modelValue: c.value,
													"onUpdate:modelValue":
														r[1] ||
														(r[1] = (x) =>
															(c.value = x)),
													tabs: y.value,
												},
												{
													tab: f(
														({
															tab: x,
															selected: U,
														}) => [
															t("div", null, [
																t(
																	"button",
																	{
																		class: O(
																			[
																				"group -mb-px flex items-center gap-1 border-b border-transparent py-2.5 text-base text-gray-600 duration-300 ease-in-out hover:border-gray-400 hover:text-gray-900",
																				{
																					"text-gray-900":
																						U,
																				},
																			]
																		),
																	},
																	[
																		x.icon
																			? (i(),
																			  $(
																					de(
																						x.icon
																					),
																					{
																						key: 0,
																						class: "h-4 stroke-1.5",
																					}
																			  ))
																			: V(
																					"",
																					!0
																			  ),
																		L(
																			" " +
																				u(
																					a.__(
																						x.label
																					)
																				) +
																				" ",
																			1
																		),
																		x.count
																			? (i(),
																			  $(
																					e(
																						Ce
																					),
																					{
																						key: 1,
																						class: O(
																							{
																								"text-gray-900 border border-gray-900":
																									U,
																							}
																						),
																						variant:
																							"subtle",
																						theme: "gray",
																						size: "sm",
																					},
																					{
																						default:
																							f(
																								() => [
																									L(
																										u(
																											x.count
																										),
																										1
																									),
																								]
																							),
																						_: 2,
																					},
																					1032,
																					[
																						"class",
																					]
																			  ))
																			: V(
																					"",
																					!0
																			  ),
																	],
																	2
																),
															]),
														]
													),
													default: f(({ tab: x }) => [
														t("div", vs, [
															x.label == "Courses"
																? (i(),
																  h("div", fs, [
																		t(
																			"div",
																			gs,
																			u(
																				a.__(
																					"Courses"
																				)
																			),
																			1
																		),
																		t(
																			"div",
																			ks,
																			[
																				(i(
																					!0
																				),
																				h(
																					w,
																					null,
																					A(
																						e(
																							v
																						)
																							.data,
																						(
																							U
																						) => (
																							i(),
																							h(
																								"div",
																								null,
																								[
																									d(
																										T,
																										{
																											to: {
																												name: "CourseDetail",
																												params: {
																													courseName:
																														U.name,
																												},
																											},
																										},
																										{
																											default:
																												f(
																													() => [
																														(i(),
																														$(
																															De,
																															{
																																key: U.name,
																																course: U,
																															},
																															null,
																															8,
																															[
																																"course",
																															]
																														)),
																													]
																												),
																											_: 2,
																										},
																										1032,
																										[
																											"to",
																										]
																									),
																								]
																							)
																						)
																					),
																					256
																				)),
																			]
																		),
																  ]))
																: x.label ==
																  "Dashboard"
																? (i(),
																  h("div", xs, [
																		d(
																			ht,
																			{
																				batch: e(
																					l
																				),
																				isStudent:
																					_.value,
																			},
																			null,
																			8,
																			[
																				"batch",
																				"isStudent",
																			]
																		),
																  ]))
																: x.label ==
																  "Live Class"
																? (i(),
																  h("div", $s, [
																		d(
																			Rt,
																			{
																				batch: e(
																					l
																				)
																					.data
																					.name,
																			},
																			null,
																			8,
																			[
																				"batch",
																			]
																		),
																  ]))
																: x.label ==
																  "Students"
																? (i(),
																  h("div", Vs, [
																		d(
																			Kt,
																			{
																				batch: e(
																					l
																				)
																					.data
																					.name,
																			},
																			null,
																			8,
																			[
																				"batch",
																			]
																		),
																  ]))
																: x.label ==
																  "Assessments"
																? (i(),
																  h("div", Cs, [
																		d(
																			ce,
																			{
																				batch: e(
																					l
																				)
																					.data
																					.name,
																			},
																			null,
																			8,
																			[
																				"batch",
																			]
																		),
																  ]))
																: x.label ==
																  "Announcements"
																? (i(),
																  h("div", Ss, [
																		d(
																			ls,
																			{
																				batch: e(
																					l
																				)
																					.data
																					.name,
																			},
																			null,
																			8,
																			[
																				"batch",
																			]
																		),
																  ]))
																: x.label ==
																  "Discussions"
																? (i(),
																  h("div", Ms, [
																		(i(),
																		$(
																			Ae,
																			{
																				doctype:
																					"LMS Batch",
																				docname:
																					e(
																						l
																					)
																						.data
																						.name,
																				title: "Discussions",
																				key: e(
																					l
																				)
																					.data
																					.name,
																				singleThread:
																					!0,
																			},
																			null,
																			8,
																			[
																				"docname",
																			]
																		)),
																  ]))
																: V("", !0),
														]),
													]),
													_: 1,
												},
												8,
												["modelValue", "tabs"]
											),
										]),
										t("div", ws, [
											t("div", Ls, u(e(l).data.title), 1),
											t("div", Ds, [
												d(e(J), {
													class: "h-4 w-4 stroke-1.5 mr-2 text-gray-700",
												}),
												t(
													"span",
													null,
													u(
														e(b)(
															e(l).data.start_date
														).format("DD MMMM YYYY")
													) +
														" - " +
														u(
															e(b)(
																e(l).data
																	.end_date
															).format(
																"DD MMMM YYYY"
															)
														),
													1
												),
											]),
											t("div", js, [
												d(e(G), {
													class: "h-4 w-4 stroke-1.5 mr-2 text-gray-700",
												}),
												t(
													"span",
													null,
													u(
														e(E)(
															e(l).data.start_time
														)
													) +
														" - " +
														u(
															e(E)(
																e(l).data
																	.end_time
															)
														),
													1
												),
											]),
											t(
												"div",
												{
													innerHTML:
														e(l).data.description,
												},
												null,
												8,
												As
											),
										]),
										d(
											_s,
											{
												modelValue: p.value,
												"onUpdate:modelValue":
													r[2] ||
													(r[2] = (x) =>
														(p.value = x)),
												batch: e(l).data.name,
												students: e(l).data.students,
											},
											null,
											8,
											["modelValue", "batch", "students"]
										),
								  ]))
								: V("", !0),
					  ]))
					: (Q = e(o).data) != null && Q.name
					? V("", !0)
					: (i(),
					  h("div", Ts, [
							t("div", Us, [
								t("div", Bs, [
									Es,
									L(" " + u(a.__("Not Permitted")), 1),
								]),
								t("div", Ns, [
									e(o).data
										? (i(),
										  h(
												"div",
												Ps,
												u(
													a.__(
														"You are not a member of this batch. Please checkout our upcoming batches."
													)
												),
												1
										  ))
										: (i(),
										  h(
												"div",
												Ys,
												u(
													a.__(
														"Please login to access this page."
													)
												),
												1
										  )),
									e(o).data
										? (i(),
										  $(
												T,
												{
													key: 2,
													to: {
														name: "Batches",
														params: {
															batchName:
																(W =
																	e(
																		l
																	).data) ==
																null
																	? void 0
																	: W.name,
														},
													},
												},
												{
													default: f(() => [
														d(
															e(D),
															{
																variant:
																	"solid",
																class: "w-full",
															},
															{
																default: f(
																	() => [
																		L(
																			u(
																				a.__(
																					"Upcoming Batches"
																				)
																			),
																			1
																		),
																	]
																),
																_: 1,
															}
														),
													]),
													_: 1,
												},
												8,
												["to"]
										  ))
										: (i(),
										  $(
												e(D),
												{
													key: 3,
													variant: "solid",
													class: "w-full",
													onClick:
														r[3] ||
														(r[3] = (x) => k()),
												},
												{
													default: f(() => [
														L(u(a.__("Login")), 1),
													]),
													_: 1,
												}
										  )),
								]),
							]),
					  ]));
			};
		},
	};
export { Qs as default };
//# sourceMappingURL=Batch-UFfl4NY5.js.map
