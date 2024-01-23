var ce = Object.defineProperty;
var W = Object.getOwnPropertySymbols;
var me = Object.prototype.hasOwnProperty,
	_e = Object.prototype.propertyIsEnumerable;
var K = (c, y, l) =>
		y in c
			? ce(c, y, {
					enumerable: !0,
					configurable: !0,
					writable: !0,
					value: l,
			  })
			: (c[y] = l),
	R = (c, y) => {
		for (var l in y || (y = {})) me.call(y, l) && K(c, l, y[l]);
		if (W) for (var l of W(y)) _e.call(y, l) && K(c, l, y[l]);
		return c;
	};
var X = (c, y, l) =>
	new Promise((p, f) => {
		var a = (u) => {
				try {
					m(l.next(u));
				} catch (_) {
					f(_);
				}
			},
			s = (u) => {
				try {
					m(l.throw(u));
				} catch (_) {
					f(_);
				}
			},
			m = (u) =>
				u.done ? p(u.value) : Promise.resolve(u.value).then(a, s);
		m((l = l.apply(c, y)).next());
	});
import {
	aa as I,
	a as S,
	ab as A,
	b as F,
	k as M,
	w as ee,
	x as i,
	A as V,
	B as v,
	H as r,
	J as t,
	ak as H,
	G as e,
	F as n,
	al as oe,
	Q as L,
	C as O,
	y as b,
	R as U,
	I as C,
	D as q,
	r as T,
	U as D,
	a7 as j,
	c as Z,
	ae as le,
	am as Y,
	T as te,
	ac as pe,
	a5 as ne,
	an as he,
	ao as be,
	M as ie,
	ap as ye,
	aq as ve,
	ar as fe,
	as as de,
	at as ge,
	au as ke,
	j as se,
	W as xe,
	a6 as $e,
	a8 as Ve,
	a9 as Ce,
} from "./frappe-ui-iPT8hMkb.js";
import {
	a as w,
	f as E,
	c as z,
	g as Se,
	t as Me,
	B as we,
} from "./index-qZ7Yta4u.js";
import { _ as Le } from "./CourseCard-1i2yp1tI.js";
import { C as J, a as G } from "./clock-z0R6Od6V.js";
import { P as re } from "./plus-_m-8cMp1.js";
import { _ as De } from "./Link-4jJRdvJb.js";
import { _ as je } from "./Discussions-0iopHFAD.js";
import { B as Ae } from "./book-open-check-5hpjM2tX.js";
import "./UserAvatar-nJqmkBPv.js";
import "./star-xishKgdq.js";
/**
 * @license lucide-vue-next v0.309.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const Ue = w("Contact2Icon", [
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
 */ const ae = w("InfoIcon", [
	["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
	["path", { d: "M12 16v-4", key: "1dtifu" }],
	["path", { d: "M12 8h.01", key: "e9boi3" }],
]);
/**
 * @license lucide-vue-next v0.309.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const Be = w("LaptopIcon", [
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
 */ const Te = w("LayoutDashboardIcon", [
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
 */ const Ee = w("MailIcon", [
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
 */ const Ne = w("MessageCircleIcon", [
	["path", { d: "M7.9 20A9 9 0 1 0 4 16.1L2 22Z", key: "vv11sd" }],
]);
/**
 * @license lucide-vue-next v0.309.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const Pe = w("MonitorIcon", [
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
 */ const Ye = w("SendIcon", [
	["path", { d: "m22 2-7 20-4-9-9-4Z", key: "1q3vgg" }],
	["path", { d: "M22 2 11 13", key: "nzbqef" }],
]);
/**
 * @license lucide-vue-next v0.309.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const ze = w("Trash2Icon", [
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
 */ const Ie = w("UserRoundCogIcon", [
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
 */ const qe = w("VideoIcon", [
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
	Re = { class: "flex flex-col gap-4" },
	He = { class: "mb-1.5 text-sm text-gray-600" },
	Oe = { class: "mb-1.5 text-sm text-gray-600" },
	Fe = { key: 0 },
	Ze = { class: "mb-1.5 text-sm text-gray-600" },
	Je = { class: "grid grid-cols-2 gap-2" },
	Ge = ["onClick"],
	Qe = {
		__name: "EvaluationModal",
		props: I(
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
		setup(c) {
			const y = S("$user"),
				l = S("$dayjs"),
				p = A(c, "modelValue"),
				f = A(c, "reloadEvals"),
				a = c;
			let s = F({
				course: "",
				date: "",
				start_time: "",
				end_time: "",
				day: "",
				batch: a.batch,
				member: y.data.name,
			});
			const m = M({
				url: "frappe.client.insert",
				makeParams(o) {
					return {
						doc: R(
							{
								doctype: "LMS Certificate Request",
								batch_name: o.batch,
							},
							o
						),
					};
				},
			});
			function u(o) {
				m.submit(s, {
					validate() {
						if (!s.course) return "Please select a course.";
						if (!s.date) return "Please select a date.";
						if (!s.start_time) return "Please select a slot.";
						if (l(s.date).isSameOrBefore(l(), "day"))
							return "Please select a future date.";
						if (l(s.date).isAfter(l(a.endDate), "day"))
							return `Please select a date before the end date ${l(
								a.endDate
							).format("DD MMMM YYYY")}.`;
					},
					onSuccess() {
						f.value.reload(), o();
					},
					onError(h) {
						var d;
						z({
							title: "Error",
							text:
								((d = h.messages) == null ? void 0 : d[0]) || h,
							icon: "x",
							iconClasses:
								"bg-red-600 text-white rounded-md p-px",
							position: "top-center",
							timeout: 10,
						});
					},
				});
			}
			const _ = () => {
					let o = [];
					for (const h of a.courses)
						o.push({ label: h.title, value: h.course });
					return o;
				},
				g = M({
					url: "lms.lms.doctype.course_evaluator.course_evaluator.get_schedule",
					makeParams(o) {
						return {
							course: o.course,
							date: o.date,
							batch: a.batch,
						};
					},
				});
			ee(
				() => s.date,
				(o) => {
					(s.start_time = ""), o && g.submit(s);
				}
			),
				ee(
					() => s.course,
					(o) => {
						(s.date = ""), (s.start_time = ""), g.reset();
					}
				);
			const k = (o) => {
				(s.start_time = o.start_time),
					(s.end_time = o.end_time),
					(s.day = o.day);
			};
			return (o, h) => (
				i(),
				V(
					e(q),
					{
						modelValue: p.value,
						"onUpdate:modelValue":
							h[2] || (h[2] = (d) => (p.value = d)),
						options: {
							title: o.__("Schedule Evaluation"),
							size: "xl",
							actions: [
								{
									label: "Submit",
									variant: "solid",
									onClick: (d) => u(d),
								},
							],
						},
					},
					{
						"body-content": v(() => [
							t("div", Re, [
								t("div", null, [
									t("div", He, r(o.__("Course")), 1),
									n(
										e(H),
										{
											modelValue: e(s).course,
											"onUpdate:modelValue":
												h[0] ||
												(h[0] = (d) =>
													(e(s).course = d)),
											options: _(),
										},
										null,
										8,
										["modelValue", "options"]
									),
								]),
								t("div", null, [
									t("div", Oe, r(o.__("Date")), 1),
									n(
										e(oe),
										{
											modelValue: e(s).date,
											"onUpdate:modelValue":
												h[1] ||
												(h[1] = (d) => (e(s).date = d)),
										},
										null,
										8,
										["modelValue"]
									),
								]),
								e(g).data
									? (i(),
									  b("div", Fe, [
											t(
												"div",
												Ze,
												r(o.__("Select a slot")),
												1
											),
											t("div", Je, [
												(i(!0),
												b(
													L,
													null,
													U(
														e(g).data,
														(d) => (
															i(),
															b("div", null, [
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
																						d.start_time,
																				},
																			]
																		),
																		onClick:
																			(
																				$
																			) =>
																				k(
																					d
																				),
																	},
																	r(
																		e(E)(
																			d.start_time
																		)
																	) +
																		" - " +
																		r(
																			e(
																				E
																			)(
																				d.end_time
																			)
																		),
																	11,
																	Ge
																),
															])
														)
													),
													256
												)),
											]),
									  ]))
									: C("", !0),
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
	Ke = { class: "text-lg font-semibold mb-4" },
	Xe = { key: 1 },
	et = { class: "grid grid-cols-2 gap-4" },
	tt = { class: "border rounded-md p-3" },
	st = { class: "font-medium mb-3" },
	at = { class: "flex items-center mb-2" },
	ot = { class: "ml-2" },
	lt = { class: "flex items-center mb-2" },
	nt = { class: "ml-2" },
	it = { class: "flex items-center" },
	dt = { class: "ml-2 font-medium" },
	rt = { key: 2, class: "text-sm italic text-gray-600" },
	ut = {
		__name: "UpcomingEvaluations",
		props: {
			batch: { type: String, default: null },
			courses: { type: Array, default: [] },
			isStudent: { type: Boolean, default: !1 },
			endDate: { type: String, default: null },
		},
		setup(c) {
			const y = S("$dayjs"),
				l = S("$user"),
				p = T(!1),
				f = c,
				a = M({
					url: "lms.lms.utils.get_upcoming_evals",
					cache: ["upcoming_evals", l.data.name],
					params: {
						student: l.data.name,
						courses: f.courses.map((m) => m.course),
					},
					auto: !0,
				});
			function s() {
				p.value = !0;
			}
			return (m, u) => (
				i(),
				b(
					L,
					null,
					[
						t("div", We, [
							c.isStudent
								? (i(),
								  V(
										e(j),
										{
											key: 0,
											onClick: s,
											class: "float-right",
										},
										{
											default: v(() => [
												D(
													r(
														m.__(
															"Schedule Evaluation"
														)
													),
													1
												),
											]),
											_: 1,
										}
								  ))
								: C("", !0),
							t("div", Ke, r(m.__("Upcoming Evaluations")), 1),
							e(a).data
								? (i(),
								  b("div", Xe, [
										t("div", et, [
											(i(!0),
											b(
												L,
												null,
												U(
													e(a).data,
													(_) => (
														i(),
														b("div", null, [
															t("div", tt, [
																t(
																	"div",
																	st,
																	r(
																		_.course_title
																	),
																	1
																),
																t("div", at, [
																	n(e(J), {
																		class: "w-4 h-4 stroke-1.5",
																	}),
																	t(
																		"span",
																		ot,
																		r(
																			e(
																				y
																			)(
																				_.date
																			).format(
																				"DD MMMM YYYY"
																			)
																		),
																		1
																	),
																]),
																t("div", lt, [
																	n(e(G), {
																		class: "w-4 h-4 stroke-1.5",
																	}),
																	t(
																		"span",
																		nt,
																		r(
																			e(
																				E
																			)(
																				_.start_time
																			)
																		),
																		1
																	),
																]),
																t("div", it, [
																	n(e(Ie), {
																		class: "w-4 h-4 stroke-1.5",
																	}),
																	t(
																		"span",
																		dt,
																		r(
																			_.evaluator_name
																		),
																		1
																	),
																]),
															]),
														])
													)
												),
												256
											)),
										]),
								  ]))
								: (i(),
								  b(
										"div",
										rt,
										r(m.__("No upcoming evaluations.")),
										1
								  )),
						]),
						n(
							Qe,
							{
								batch: c.batch,
								endDate: c.endDate,
								courses: c.courses,
								modelValue: p.value,
								"onUpdate:modelValue":
									u[0] || (u[0] = (_) => (p.value = _)),
								reloadEvals: e(a),
								"onUpdate:reloadEvals":
									u[1] ||
									(u[1] = (_) =>
										Z(a) ? (a.value = _) : null),
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
		},
	},
	ct = { class: "text-lg font-semibold mb-4" },
	mt = { key: 0 },
	_t = { key: 1, class: "text-sm italic text-gray-600" },
	ue = {
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
		setup(c) {
			const y = S("$user"),
				p = M({
					url: "lms.lms.utils.get_assessments",
					params: { batch: c.batch },
					auto: !0,
				}),
				f = () => {
					var s;
					let a = [
						{ label: "Assessment", key: "title" },
						{ label: "Type", key: "assessment_type" },
					];
					return (
						((s = y.data) != null && s.is_moderator) ||
							a.push({
								label: "Status/Score",
								key: "status",
								align: "center",
							}),
						a
					);
				};
			return (a, s) => {
				var m;
				return (
					i(),
					b("div", null, [
						t("div", ct, r(a.__("Assessments")), 1),
						(m = e(p).data) != null && m.length
							? (i(),
							  b("div", mt, [
									n(
										e(le),
										{
											columns: f(),
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
							: (i(), b("div", _t, r(a.__("No Assessments")), 1)),
					])
				);
			};
		},
	},
	pt = {
		__name: "BatchDashboard",
		props: {
			batch: { type: Object, default: null },
			isStudent: { type: Boolean, default: !1 },
		},
		setup(c) {
			return (y, l) => (
				i(),
				b("div", null, [
					n(
						ut,
						{
							batch: c.batch.data.name,
							endDate: c.batch.data.evaluation_end_date,
							courses: c.batch.data.courses,
							isStudent: c.isStudent,
						},
						null,
						8,
						["batch", "endDate", "courses", "isStudent"]
					),
					n(ue, { batch: c.batch.data.name }, null, 8, ["batch"]),
				])
			);
		},
	},
	ht = { class: "flex flex-col gap-4" },
	bt = { class: "grid grid-cols-2 gap-4" },
	yt = { class: "mb-4" },
	vt = { class: "mb-1.5 text-sm text-gray-600" },
	ft = { class: "mb-4" },
	gt = { class: "mb-1.5 text-sm text-gray-600" },
	kt = { class: "mb-1.5 text-sm text-gray-600" },
	xt = { class: "mb-4" },
	$t = { class: "mb-1.5 text-sm text-gray-600" },
	Vt = { class: "mb-4" },
	Ct = { class: "mb-1.5 text-sm text-gray-600" },
	St = { class: "mb-1.5 text-sm text-gray-600" },
	Mt = { class: "mb-1.5 text-sm text-gray-600" },
	wt = {
		__name: "LiveClassModal",
		props: I(
			{ batch: { type: String, default: null } },
			{
				reloadLiveClasses: {},
				reloadLiveClassesModifiers: {},
				modelValue: {},
				modelModifiers: {},
			}
		),
		emits: ["update:reloadLiveClasses", "update:modelValue"],
		setup(c) {
			const y = A(c, "reloadLiveClasses"),
				l = A(c, "modelValue"),
				p = S("$user"),
				f = S("$dayjs");
			let s = F({
				title: "",
				description: "",
				date: "",
				time: "",
				duration: "",
				timezone: "",
				auto_recording: "No Recording",
				batch: c.batch,
				host: p.data.name,
			});
			const m = () => Se().map((o) => ({ label: o, value: o })),
				u = () => [
					{ label: "No Recording", value: "No Recording" },
					{ label: "Local", value: "Local" },
					{ label: "Cloud", value: "Cloud" },
				],
				_ = M({
					url: "lms.lms.doctype.lms_batch.lms_batch.create_live_class",
					makeParams(o) {
						return R(
							{ doctype: "LMS Live Class", batch_name: o.batch },
							o
						);
					},
				}),
				g = (o) => {
					_.submit(s, {
						validate() {
							if (!s.title) return "Please enter a title.";
							if (!s.date) return "Please select a date.";
							if (f(s.date).isSameOrBefore(f(), "day"))
								return "Please select a future date.";
							if (!s.time) return "Please select a time.";
							if (!k())
								return "Please enter a valid time in the format HH:mm.";
							if (!s.duration) return "Please select a duration.";
							if (!s.timezone) return "Please select a timezone.";
						},
						onSuccess() {
							y.value.reload(), o();
						},
						onError(h) {
							var d;
							z({
								title: "Error",
								text:
									((d = h.messages) == null
										? void 0
										: d[0]) || h,
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
					let o = s.time.split(":");
					return !(
						o.length != 2 ||
						o[0] < 0 ||
						o[0] > 23 ||
						o[1] < 0 ||
						o[1] > 59
					);
				};
			return (o, h) => (
				i(),
				V(
					e(q),
					{
						modelValue: l.value,
						"onUpdate:modelValue":
							h[7] || (h[7] = (d) => (l.value = d)),
						options: {
							title: o.__("Create a Live Class"),
							size: "xl",
							actions: [
								{
									label: "Submit",
									variant: "solid",
									onClick: (d) => g(d),
								},
							],
						},
					},
					{
						"body-content": v(() => [
							t("div", ht, [
								t("div", bt, [
									t("div", null, [
										t("div", yt, [
											t("div", vt, r(o.__("Title")), 1),
											n(
												e(Y),
												{
													type: "text",
													modelValue: e(s).title,
													"onUpdate:modelValue":
														h[0] ||
														(h[0] = (d) =>
															(e(s).title = d)),
												},
												null,
												8,
												["modelValue"]
											),
										]),
										t("div", ft, [
											t("div", gt, [
												n(
													e(te),
													{
														class: "flex items-center",
														text: o.__(
															"Time must be in 24 hour format (HH:mm). Example 11:30 or 22:00"
														),
													},
													{
														default: v(() => [
															t(
																"span",
																null,
																r(o.__("Time")),
																1
															),
															n(e(ae), {
																class: "stroke-2 w-3 h-3 ml-1",
															}),
														]),
														_: 1,
													},
													8,
													["text"]
												),
											]),
											n(
												e(Y),
												{
													modelValue: e(s).time,
													"onUpdate:modelValue":
														h[1] ||
														(h[1] = (d) =>
															(e(s).time = d)),
												},
												null,
												8,
												["modelValue"]
											),
										]),
										t("div", null, [
											t(
												"div",
												kt,
												r(o.__("Timezone")),
												1
											),
											n(
												e(H),
												{
													modelValue: e(s).timezone,
													"onUpdate:modelValue":
														h[2] ||
														(h[2] = (d) =>
															(e(s).timezone =
																d)),
													options: m(),
												},
												null,
												8,
												["modelValue", "options"]
											),
										]),
									]),
									t("div", null, [
										t("div", xt, [
											t("div", $t, r(o.__("Date")), 1),
											n(
												e(oe),
												{
													modelValue: e(s).date,
													"onUpdate:modelValue":
														h[3] ||
														(h[3] = (d) =>
															(e(s).date = d)),
													inputClass: "w-full",
												},
												null,
												8,
												["modelValue"]
											),
										]),
										t("div", Vt, [
											t("div", Ct, [
												n(
													e(te),
													{
														class: "flex items-center",
														text: o.__(
															"Duration of the live class in minutes"
														),
													},
													{
														default: v(() => [
															t(
																"span",
																null,
																r(
																	o.__(
																		"Duration"
																	)
																),
																1
															),
															n(e(ae), {
																class: "stroke-2 w-3 h-3 ml-1",
															}),
														]),
														_: 1,
													},
													8,
													["text"]
												),
											]),
											n(
												e(Y),
												{
													type: "number",
													modelValue: e(s).duration,
													"onUpdate:modelValue":
														h[4] ||
														(h[4] = (d) =>
															(e(s).duration =
																d)),
												},
												null,
												8,
												["modelValue"]
											),
										]),
										t("div", null, [
											t(
												"div",
												St,
												r(o.__("Auto Recording")),
												1
											),
											n(
												e(H),
												{
													modelValue:
														e(s).auto_recording,
													"onUpdate:modelValue":
														h[5] ||
														(h[5] = (d) =>
															(e(
																s
															).auto_recording =
																d)),
													options: u(),
												},
												null,
												8,
												["modelValue", "options"]
											),
										]),
									]),
								]),
								t("div", null, [
									t("div", Mt, r(o.__("Description")), 1),
									n(
										e(pe),
										{
											modelValue: e(s).description,
											"onUpdate:modelValue":
												h[6] ||
												(h[6] = (d) =>
													(e(s).description = d)),
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
	Lt = { class: "text-lg font-semibold mb-4" },
	Dt = { key: 1, class: "grid grid-cols-2 gap-5" },
	jt = { class: "border rounded-md p-3" },
	At = { class: "font-semibold text-lg mb-4" },
	Ut = { class: "flex items-center mb-2" },
	Bt = { class: "ml-2" },
	Tt = { class: "flex items-center mb-5" },
	Et = { class: "ml-2" },
	Nt = { class: "mb-5" },
	Pt = { class: "flex items-center gap-2" },
	Yt = ["href"],
	zt = ["href"],
	It = { key: 2, class: "text-sm italic text-gray-600" },
	qt = {
		__name: "LiveClass",
		props: { batch: { type: String, required: !0 } },
		setup(c) {
			const y = S("$user"),
				l = T(!1),
				p = S("$dayjs"),
				f = c,
				a = ne({
					doctype: "LMS Live Class",
					filters: { batch: f.batchName, date: [">=", new Date()] },
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
					l.value = !0;
				};
			return (m, u) => {
				var _;
				return (
					i(),
					b(
						L,
						null,
						[
							e(y).data.is_moderator
								? (i(),
								  V(
										e(j),
										{
											key: 0,
											variant: "solid",
											class: "float-right mb-3",
											onClick: s,
										},
										{
											prefix: v(() => [
												n(e(re), { class: "h-4 w-4" }),
											]),
											default: v(() => [
												t(
													"span",
													null,
													r(m.__("Create")),
													1
												),
											]),
											_: 1,
										}
								  ))
								: C("", !0),
							t("div", Lt, r(m.__("Live Class")), 1),
							(_ = e(a).data) != null && _.length
								? (i(),
								  b("div", Dt, [
										(i(!0),
										b(
											L,
											null,
											U(
												e(a).data,
												(g) => (
													i(),
													b("div", null, [
														t("div", jt, [
															t(
																"div",
																At,
																r(g.title),
																1
															),
															t("div", Ut, [
																n(e(J), {
																	class: "w-4 h-4 stroke-1.5",
																}),
																t(
																	"span",
																	Bt,
																	r(
																		e(p)(
																			g.date
																		).format(
																			"DD MMMM YYYY"
																		)
																	),
																	1
																),
															]),
															t("div", Tt, [
																n(e(G), {
																	class: "w-4 h-4 stroke-1.5",
																}),
																t(
																	"span",
																	Et,
																	r(
																		e(E)(
																			g.time
																		)
																	),
																	1
																),
															]),
															t(
																"div",
																Nt,
																r(
																	g.description
																),
																1
															),
															t("div", Pt, [
																t(
																	"a",
																	{
																		href: g.start_url,
																		target: "_blank",
																		class: "w-1/2 cursor-pointer inline-flex items-center justify-center gap-2 transition-colors focus:outline-none text-gray-800 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 focus-visible:ring focus-visible:ring-gray-400 h-7 text-base px-2 rounded",
																	},
																	[
																		n(
																			e(
																				Pe
																			),
																			{
																				class: "h-4 w-4 stroke-1.5",
																			}
																		),
																		D(
																			" " +
																				r(
																					m.__(
																						"Start"
																					)
																				),
																			1
																		),
																	],
																	8,
																	Yt
																),
																t(
																	"a",
																	{
																		href: g.join_url,
																		target: "_blank",
																		class: "w-1/2 cursor-pointer inline-flex items-center justify-center gap-2 transition-colors focus:outline-none text-gray-800 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 focus-visible:ring focus-visible:ring-gray-400 h-7 text-base px-2 rounded",
																	},
																	[
																		n(
																			e(
																				qe
																			),
																			{
																				class: "h-4 w-4 stroke-1.5",
																			}
																		),
																		D(
																			" " +
																				r(
																					m.__(
																						"Join"
																					)
																				),
																			1
																		),
																	],
																	8,
																	zt
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
								  b(
										"div",
										It,
										r(m.__("No live classes scheduled")),
										1
								  )),
							n(
								wt,
								{
									batch: f.batch,
									modelValue: l.value,
									"onUpdate:modelValue":
										u[0] || (u[0] = (g) => (l.value = g)),
									reloadLiveClasses: e(a),
									"onUpdate:reloadLiveClasses":
										u[1] ||
										(u[1] = (g) =>
											Z(a) ? (a.value = g) : null),
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
	Rt = { class: "flex flex-col gap-4" },
	Ht = {
		__name: "StudentModal",
		props: I(
			{ batch: { type: String, default: null } },
			{
				reloadStudents: {},
				reloadStudentsModifiers: {},
				modelValue: {},
				modelModifiers: {},
			}
		),
		emits: ["update:reloadStudents", "update:modelValue"],
		setup(c) {
			const y = A(c, "reloadStudents"),
				l = T(),
				p = A(c, "modelValue"),
				f = c,
				a = M({
					url: "frappe.client.insert",
					makeParams(m) {
						return {
							doc: {
								doctype: "Batch Student",
								parent: f.batch,
								parenttype: "LMS Batch",
								parentfield: "students",
								student: l.value,
							},
						};
					},
				}),
				s = (m) => {
					a.submit(
						{},
						{
							onSuccess() {
								y.value.reload(), m(), (l.value = null);
							},
						}
					);
				};
			return (m, u) => (
				i(),
				V(
					e(q),
					{
						modelValue: p.value,
						"onUpdate:modelValue":
							u[1] || (u[1] = (_) => (p.value = _)),
						options: {
							title: m.__("Add a Student"),
							size: "xl",
							actions: [
								{
									label: "Submit",
									variant: "solid",
									onClick: (_) => s(_),
								},
							],
						},
					},
					{
						"body-content": v(() => [
							t("div", Rt, [
								n(
									De,
									{
										doctype: "User",
										modelValue: l.value,
										"onUpdate:modelValue":
											u[0] ||
											(u[0] = (_) => (l.value = _)),
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
	Ot = { class: "text-lg font-semibold mb-4" },
	Ft = { key: 0 },
	Zt = { key: 0 },
	Jt = { class: "flex gap-2" },
	Gt = {
		__name: "BatchStudents",
		props: { batch: { type: String, default: null } },
		setup(c) {
			const y = T(!1),
				l = c,
				p = M({
					url: "lms.lms.utils.get_batch_students",
					cache: ["students", l.batch],
					params: { batch: l.batch },
					auto: !0,
				}),
				f = () => [
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
				a = () => {
					y.value = !0;
				},
				s = M({
					url: "frappe.client.delete",
					makeParams(u) {
						return { doctype: "Batch Student", name: u.student };
					},
				}),
				m = (u) => {
					u.forEach((_) =>
						X(this, null, function* () {
							console.log(_),
								s.submit({ student: _ }),
								yield setTimeout(1e3);
						})
					);
				};
			return (u, _) => {
				var g;
				return (
					i(),
					b(
						L,
						null,
						[
							n(
								e(j),
								{
									class: "float-right mb-3",
									variant: "solid",
									onClick: _[0] || (_[0] = (k) => a()),
								},
								{
									prefix: v(() => [
										n(e(re), { class: "h-4 w-4" }),
									]),
									default: v(() => [
										D(" " + r(u.__("Add Student")), 1),
									]),
									_: 1,
								}
							),
							t("div", Ot, r(u.__("Students")), 1),
							(g = e(p).data) != null && g.length
								? (i(),
								  b("div", Ft, [
										n(
											e(le),
											{
												columns: f(),
												rows: e(p).data,
												"row-key": "name",
												options: { showTooltip: !1 },
											},
											{
												default: v(() => [
													n(
														e(he),
														{
															class: "mb-2 grid items-center space-x-4 rounded bg-gray-100 p-2",
														},
														{
															default: v(() => [
																(i(!0),
																b(
																	L,
																	null,
																	U(
																		f(),
																		(k) => (
																			i(),
																			V(
																				e(
																					be
																				),
																				{
																					item: k,
																				},
																				{
																					prefix: v(
																						({
																							item: o,
																						}) => [
																							o.icon
																								? (i(),
																								  V(
																										ie(
																											o.icon
																										),
																										{
																											key: 0,
																											class: "h-4 w-4 stroke-1.5 ml-4",
																										}
																								  ))
																								: C(
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
													n(e(ye), null, {
														default: v(() => [
															(i(!0),
															b(
																L,
																null,
																U(
																	e(p).data,
																	(k) => (
																		i(),
																		V(
																			e(
																				ve
																			),
																			{
																				row: k,
																			},
																			{
																				default:
																					v(
																						({
																							column: o,
																							item: h,
																						}) => [
																							n(
																								e(
																									fe
																								),
																								{
																									item: k[
																										o
																											.key
																									],
																									align: o.align,
																								},
																								{
																									prefix: v(
																										() => [
																											o.key ==
																											"full_name"
																												? (i(),
																												  b(
																														"div",
																														Zt,
																														[
																															n(
																																e(
																																	de
																																),
																																{
																																	class: "flex items-center",
																																	image: k.user_image,
																																	label: h,
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
																												: C(
																														"",
																														!0
																												  ),
																										]
																									),
																									default:
																										v(
																											() => [
																												t(
																													"div",
																													null,
																													r(
																														k[
																															o
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
													n(e(ge), null, {
														actions: v(
															({
																unselectAll: k,
																selections: o,
															}) => [
																t("div", Jt, [
																	n(
																		e(j),
																		{
																			variant:
																				"ghost",
																			onClick:
																				(
																					h
																				) =>
																					m(
																						o
																					),
																		},
																		{
																			default:
																				v(
																					() => [
																						n(
																							e(
																								ze
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
																	n(
																		e(j),
																		{
																			variant:
																				"ghost",
																			label: "Unselect all",
																			onClick:
																				(
																					h
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
								: C("", !0),
							n(
								Ht,
								{
									batch: l.batch,
									modelValue: y.value,
									"onUpdate:modelValue":
										_[1] || (_[1] = (k) => (y.value = k)),
									reloadStudents: e(p),
									"onUpdate:reloadStudents":
										_[2] ||
										(_[2] = (k) =>
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
	Kt = { class: "flex items-center justify-between mb-2" },
	Xt = { class: "flex items-center" },
	es = { class: "ml-2" },
	ts = { class: "text-sm" },
	ss = ["innerHTML"],
	as = {
		__name: "Annoucements",
		props: { batch: { type: String, required: !0 } },
		setup(c) {
			const y = c,
				l = ne({
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
						reference_name: y.batch,
					},
					orderBy: "communication_date desc",
					auto: !0,
					cache: ["batch", y.batch],
				});
			return (p, f) =>
				e(l).data
					? (i(),
					  b("div", Qt, [
							(i(!0),
							b(
								L,
								null,
								U(
									e(l).data,
									(a) => (
										i(),
										b("div", null, [
											t("div", Wt, [
												t("div", Kt, [
													t("div", Xt, [
														n(
															e(de),
															{
																label: a.sender_full_name,
																size: "lg",
															},
															null,
															8,
															["label"]
														),
														t(
															"div",
															es,
															r(
																a.sender_full_name
															),
															1
														),
													]),
													t(
														"div",
														ts,
														r(
															e(Me)(
																a.communication_date
															)
														),
														1
													),
												]),
												t(
													"div",
													{
														class: "prose prose-sm bg-gray-50 !min-w-full px-4 py-2 rounded-md",
														innerHTML: a.content,
													},
													null,
													8,
													ss
												),
											]),
										])
									)
								),
								256
							)),
					  ]))
					: C("", !0);
		},
	},
	os = { class: "flex flex-col gap-4" },
	ls = { class: "" },
	ns = { class: "mb-1.5 text-sm text-gray-600" },
	is = { class: "" },
	ds = { class: "mb-1.5 text-sm text-gray-600" },
	rs = { class: "mb-4" },
	us = { class: "mb-1.5 text-sm text-gray-600" },
	cs = {
		__name: "AnnouncementModal",
		props: I(
			{
				batch: { type: String, required: !0 },
				students: { type: Array, required: !0 },
			},
			{ modelValue: {}, modelModifiers: {} }
		),
		emits: ["update:modelValue"],
		setup(c) {
			const y = A(c, "modelValue"),
				l = c,
				p = F({ subject: "", replyTo: "", announcement: "" }),
				f = M({
					url: "frappe.core.doctype.communication.email.make",
					makeParams(s) {
						return {
							recipients: l.students.join(", "),
							cc: p.replyTo,
							subject: p.subject,
							content: p.announcement,
							doctype: "LMS Batch",
							name: l.batch,
							send_email: 1,
						};
					},
				}),
				a = (s) => {
					f.submit(
						{},
						{
							validate() {
								if (!l.students.length)
									return "No students in this batch";
								if (!p.subject) return "Subject is required";
							},
							onSuccess() {
								s(),
									z({
										title: "Success",
										text: "Announcement has been sent successfully",
										icon: "Check",
										iconClasses:
											"bg-green-600 text-white rounded-md p-px",
									});
							},
							onError(m) {
								var u;
								z({
									title: "Error",
									text:
										((u = m.messages) == null
											? void 0
											: u[0]) || m,
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
			return (s, m) => (
				i(),
				V(
					e(q),
					{
						modelValue: y.value,
						"onUpdate:modelValue":
							m[3] || (m[3] = (u) => (y.value = u)),
						options: {
							title: s.__("Make an Announcement"),
							size: "xl",
							actions: [
								{
									label: "Submit",
									variant: "solid",
									onClick: (u) => a(u),
								},
							],
						},
					},
					{
						"body-content": v(() => [
							t("div", os, [
								t("div", ls, [
									t("div", ns, r(s.__("Subject")), 1),
									n(
										e(Y),
										{
											type: "text",
											modelValue: p.subject,
											"onUpdate:modelValue":
												m[0] ||
												(m[0] = (u) => (p.subject = u)),
										},
										null,
										8,
										["modelValue"]
									),
								]),
								t("div", is, [
									t("div", ds, r(s.__("Reply To")), 1),
									n(
										e(Y),
										{
											type: "text",
											modelValue: p.replyTo,
											"onUpdate:modelValue":
												m[1] ||
												(m[1] = (u) => (p.replyTo = u)),
										},
										null,
										8,
										["modelValue"]
									),
								]),
								t("div", rs, [
									t("div", us, r(s.__("Announcement")), 1),
									n(e(ke), {
										bubbleMenu: !0,
										onChange:
											m[2] ||
											(m[2] = (u) =>
												(p.announcement = u)),
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
	ms = { key: 0, class: "h-screen text-base" },
	_s = {
		class: "sticky top-0 z-10 flex items-center justify-between border-b bg-white px-3 py-2.5 sm:px-5",
	},
	ps = { key: 0, class: "grid grid-cols-[70%,30%] h-full" },
	hs = { class: "border-r-2" },
	bs = { class: "pt-5 px-10 pb-10" },
	ys = { key: 0 },
	vs = { class: "text-xl font-semibold" },
	fs = { class: "grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 gap-8 mt-5" },
	gs = { key: 1 },
	ks = { key: 2 },
	xs = { key: 3 },
	$s = { key: 4 },
	Vs = { key: 5 },
	Cs = { key: 6 },
	Ss = { class: "p-5" },
	Ms = { class: "text-2xl font-semibold mb-3" },
	ws = { class: "flex items-center mb-3" },
	Ls = { class: "flex items-center mb-6" },
	Ds = ["innerHTML"],
	js = { key: 1, class: "h-screen" },
	As = { class: "text-base border rounded-md w-1/3 mx-auto my-32" },
	Us = { class: "border-b px-5 py-3 font-medium" },
	Bs = t(
		"span",
		{
			class: "inline-flex items-center before:bg-red-600 before:w-2 before:h-2 before:rounded-md before:mr-2",
		},
		null,
		-1
	),
	Ts = { class: "px-5 py-3" },
	Es = { key: 0, class: "mb-4 leading-6" },
	Ns = { key: 1, class: "mb-4 leading-6" },
	Gs = {
		__name: "Batch",
		props: { batchName: { type: String, required: !0 } },
		setup(c) {
			var h;
			const y = S("$dayjs"),
				l = S("$user"),
				p = T(!1),
				f = c,
				a = M({
					url: "lms.lms.utils.get_batch_details",
					cache: ["batch", f.batchName],
					params: { batch: f.batchName },
					auto: !0,
				}),
				s = se(() => {
					var $, N, P;
					let d = [
						{ label: "All Batches", route: { name: "Batches" } },
					];
					return (
						m.value ||
							d.push({
								label: ($ = a.data) == null ? void 0 : $.title,
								route: {
									name: "BatchDetail",
									params: {
										batchName:
											(N = a.data) == null
												? void 0
												: N.name,
									},
								},
							}),
						d.push({
							label:
								(P = a == null ? void 0 : a.data) == null
									? void 0
									: P.title,
							route: {
								name: "Batch",
								params: { batchName: f.batchName },
							},
						}),
						d
					);
				}),
				m = se(() => {
					var d, $;
					return (
						(l == null ? void 0 : l.data) &&
						((d = a.data) == null ? void 0 : d.students.length) &&
						(($ = a.data) == null
							? void 0
							: $.students.includes(l.data.name))
					);
				}),
				u = T(0),
				_ = [];
			m.value && _.push({ label: "Dashboard", icon: Te }),
				(h = l.data) != null &&
					h.is_moderator &&
					(_.push({ label: "Students", icon: Ue }),
					_.push({ label: "Assessments", icon: Ae })),
				_.push({ label: "Live Class", icon: Be }),
				_.push({ label: "Courses", icon: we }),
				_.push({ label: "Announcements", icon: Ee }),
				_.push({ label: "Discussions", icon: Ne });
			const g = M({
					url: "lms.lms.utils.get_batch_courses",
					params: { batch: f.batchName },
					cache: ["batchCourses", f.batchName],
					auto: !0,
				}),
				k = () => {
					window.location.href = "/login?redirect-to=/batches";
				},
				o = () => {
					p.value = !0;
				};
			return (d, $) => {
				var P, Q;
				const N = xe("router-link");
				return ((P = e(l).data) != null && P.is_moderator) || m.value
					? (i(),
					  b("div", ms, [
							t("header", _s, [
								n(
									e($e),
									{ class: "h-7", items: s.value },
									null,
									8,
									["items"]
								),
								n(
									e(j),
									{ onClick: $[0] || ($[0] = (x) => o()) },
									{
										suffix: v(() => [
											n(e(Ye), {
												class: "h-4 stroke-1.5",
											}),
										]),
										default: v(() => [
											t(
												"span",
												null,
												r(d.__("Make an Announcement")),
												1
											),
										]),
										_: 1,
									}
								),
							]),
							e(a).data
								? (i(),
								  b("div", ps, [
										t("div", hs, [
											n(
												e(Ce),
												{
													class: "overflow-hidden",
													modelValue: u.value,
													"onUpdate:modelValue":
														$[1] ||
														($[1] = (x) =>
															(u.value = x)),
													tabs: _,
												},
												{
													tab: v(
														({
															tab: x,
															selected: B,
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
																						B,
																				},
																			]
																		),
																	},
																	[
																		x.icon
																			? (i(),
																			  V(
																					ie(
																						x.icon
																					),
																					{
																						key: 0,
																						class: "h-4 stroke-1.5",
																					}
																			  ))
																			: C(
																					"",
																					!0
																			  ),
																		D(
																			" " +
																				r(
																					d.__(
																						x.label
																					)
																				) +
																				" ",
																			1
																		),
																		x.count
																			? (i(),
																			  V(
																					e(
																						Ve
																					),
																					{
																						key: 1,
																						class: O(
																							{
																								"text-gray-900 border border-gray-900":
																									B,
																							}
																						),
																						variant:
																							"subtle",
																						theme: "gray",
																						size: "sm",
																					},
																					{
																						default:
																							v(
																								() => [
																									D(
																										r(
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
																			: C(
																					"",
																					!0
																			  ),
																	],
																	2
																),
															]),
														]
													),
													default: v(({ tab: x }) => [
														t("div", bs, [
															x.label == "Courses"
																? (i(),
																  b("div", ys, [
																		t(
																			"div",
																			vs,
																			r(
																				d.__(
																					"Courses"
																				)
																			),
																			1
																		),
																		t(
																			"div",
																			fs,
																			[
																				(i(
																					!0
																				),
																				b(
																					L,
																					null,
																					U(
																						e(
																							g
																						)
																							.data,
																						(
																							B
																						) => (
																							i(),
																							b(
																								"div",
																								null,
																								[
																									n(
																										N,
																										{
																											to: {
																												name: "CourseDetail",
																												params: {
																													courseName:
																														B.name,
																												},
																											},
																										},
																										{
																											default:
																												v(
																													() => [
																														(i(),
																														V(
																															Le,
																															{
																																key: B.name,
																																course: B,
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
																  b("div", gs, [
																		n(
																			pt,
																			{
																				batch: e(
																					a
																				),
																				isStudent:
																					m.value,
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
																  b("div", ks, [
																		n(
																			qt,
																			{
																				batch: e(
																					a
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
																  b("div", xs, [
																		n(
																			Gt,
																			{
																				batch: e(
																					a
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
																  b("div", $s, [
																		n(
																			ue,
																			{
																				batch: e(
																					a
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
																  b("div", Vs, [
																		n(
																			as,
																			{
																				batch: e(
																					a
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
																  b("div", Cs, [
																		(i(),
																		V(
																			je,
																			{
																				doctype:
																					"LMS Batch",
																				docname:
																					e(
																						a
																					)
																						.data
																						.name,
																				title: "Discussions",
																				key: e(
																					a
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
																: C("", !0),
														]),
													]),
													_: 1,
												},
												8,
												["modelValue"]
											),
										]),
										t("div", Ss, [
											t("div", Ms, r(e(a).data.title), 1),
											t("div", ws, [
												n(e(J), {
													class: "h-4 w-4 stroke-1.5 mr-2 text-gray-700",
												}),
												t(
													"span",
													null,
													r(
														e(y)(
															e(a).data.start_date
														).format("DD MMMM YYYY")
													) +
														" - " +
														r(
															e(y)(
																e(a).data
																	.end_date
															).format(
																"DD MMMM YYYY"
															)
														),
													1
												),
											]),
											t("div", Ls, [
												n(e(G), {
													class: "h-4 w-4 stroke-1.5 mr-2 text-gray-700",
												}),
												t(
													"span",
													null,
													r(
														e(E)(
															e(a).data.start_time
														)
													) +
														" - " +
														r(
															e(E)(
																e(a).data
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
														e(a).data.description,
												},
												null,
												8,
												Ds
											),
										]),
										n(
											cs,
											{
												modelValue: p.value,
												"onUpdate:modelValue":
													$[2] ||
													($[2] = (x) =>
														(p.value = x)),
												batch: e(a).data.name,
												students: e(a).data.students,
											},
											null,
											8,
											["modelValue", "batch", "students"]
										),
								  ]))
								: C("", !0),
					  ]))
					: (i(),
					  b("div", js, [
							t("div", As, [
								t("div", Us, [
									Bs,
									D(" " + r(d.__("Not Permitted")), 1),
								]),
								t("div", Ts, [
									e(l).data
										? (i(),
										  b(
												"div",
												Es,
												r(
													d.__(
														"You are not a member of this batch. Please checkout our upcoming batches."
													)
												),
												1
										  ))
										: (i(),
										  b(
												"div",
												Ns,
												r(
													d.__(
														"Please login to access this page."
													)
												),
												1
										  )),
									e(l).data
										? (i(),
										  V(
												N,
												{
													key: 2,
													to: {
														name: "Batches",
														params: {
															batchName:
																(Q =
																	e(
																		a
																	).data) ==
																null
																	? void 0
																	: Q.name,
														},
													},
												},
												{
													default: v(() => [
														n(
															e(j),
															{
																variant:
																	"solid",
																class: "w-full",
															},
															{
																default: v(
																	() => [
																		D(
																			r(
																				d.__(
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
										  V(
												e(j),
												{
													key: 3,
													variant: "solid",
													class: "w-full",
													onClick:
														$[3] ||
														($[3] = (x) => k()),
												},
												{
													default: v(() => [
														D(r(d.__("Login")), 1),
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
export { Gs as default };
//# sourceMappingURL=Batch--wtfybfQ.js.map
