import {
	ag as N,
	k as C,
	W as b,
	x as e,
	y as o,
	J as r,
	Q as d,
	R as h,
	A as n,
	B as c,
	ah as w,
	G as t,
	C as M,
	F as l,
	H as k,
	ai as I,
	I as V,
	U as B,
	aj as R,
} from "./frappe-ui-iPT8hMkb.js";
import { a as i } from "./index-qZ7Yta4u.js";
/**
 * @license lucide-vue-next v0.309.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const j = i("ChevronRightIcon", [
	["path", { d: "m9 18 6-6-6-6", key: "mthhwq" }],
]);
/**
 * @license lucide-vue-next v0.309.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const z = i("FileTextIcon", [
	[
		"path",
		{
			d: "M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z",
			key: "1nnpy2",
		},
	],
	["polyline", { points: "14 2 14 8 20 8", key: "1ew0cm" }],
	["line", { x1: "16", x2: "8", y1: "13", y2: "13", key: "14keom" }],
	["line", { x1: "16", x2: "8", y1: "17", y2: "17", key: "17nazh" }],
	["line", { x1: "10", x2: "8", y1: "9", y2: "9", key: "1a5vjj" }],
]);
/**
 * @license lucide-vue-next v0.309.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const F = i("HelpCircleIcon", [
	["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
	["path", { d: "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3", key: "1u773s" }],
	["path", { d: "M12 17h.01", key: "p32p05" }],
]);
/**
 * @license lucide-vue-next v0.309.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const H = i("MonitorPlayIcon", [
		["path", { d: "m10 7 5 3-5 3Z", key: "29ljg6" }],
		[
			"rect",
			{
				width: "20",
				height: "14",
				x: "2",
				y: "3",
				rx: "2",
				key: "48i651",
			},
		],
		["path", { d: "M12 17v4", key: "1riwvh" }],
		["path", { d: "M8 21h8", key: "1ev6f3" }],
	]),
	L = { class: "course-outline text-base" },
	q = { class: "mt-4" },
	O = { class: "text-base" },
	T = { class: "outline-lesson mb-2 pl-9" },
	P = { class: "flex items-center text-sm" },
	D = {
		__name: "CourseOutline",
		props: { courseName: { type: String, required: !0 } },
		setup(m) {
			const x = N(),
				y = m,
				_ = C({
					url: "lms.lms.utils.get_course_outline",
					cache: ["course_outline", y.courseName],
					params: { course: y.courseName },
					auto: !0,
				}),
				f = (u) => u == x.params.chapterNumber || u == 1;
			return (u, Q) => {
				const g = b("router-link");
				return (
					e(),
					o("div", L, [
						r("div", q, [
							(e(!0),
							o(
								d,
								null,
								h(
									t(_).data,
									(s, v) => (
										e(),
										n(
											t(R),
											{
												key: s.name,
												defaultOpen: f(s.idx),
											},
											{
												default: c(({ open: p }) => [
													l(
														t(w),
														{
															class: "flex w-full px-2 pt-2 pb-3",
														},
														{
															default: c(() => [
																l(
																	t(j),
																	{
																		class: M(
																			[
																				{
																					"rotate-90 transform duration-200":
																						p,
																					"duration-200":
																						!p,
																					open:
																						v ==
																						1,
																				},
																				"h-5 w-5 text-gray-900 stroke-1 mr-2",
																			]
																		),
																	},
																	null,
																	8,
																	["class"]
																),
																r(
																	"div",
																	O,
																	k(s.title),
																	1
																),
															]),
															_: 2,
														},
														1024
													),
													l(
														t(I),
														{ class: "pb-2" },
														{
															default: c(() => [
																(e(!0),
																o(
																	d,
																	null,
																	h(
																		s.lessons,
																		(a) => (
																			e(),
																			o(
																				"div",
																				{
																					key: a.name,
																				},
																				[
																					r(
																						"div",
																						T,
																						[
																							l(
																								g,
																								{
																									to: {
																										name: "Lesson",
																										params: {
																											courseName:
																												m.courseName,
																											chapterNumber:
																												a.number.split(
																													"."
																												)[0],
																											lessonNumber:
																												a.number.split(
																													"."
																												)[1],
																										},
																									},
																								},
																								{
																									default:
																										c(
																											() => [
																												r(
																													"div",
																													P,
																													[
																														a.icon ===
																														"icon-youtube"
																															? (e(),
																															  n(
																																	t(
																																		H
																																	),
																																	{
																																		key: 0,
																																		class: "h-4 w-4 text-gray-900 stroke-1 mr-2",
																																	}
																															  ))
																															: a.icon ===
																															  "icon-quiz"
																															? (e(),
																															  n(
																																	t(
																																		F
																																	),
																																	{
																																		key: 1,
																																		class: "h-4 w-4 text-gray-900 stroke-1 mr-2",
																																	}
																															  ))
																															: a.icon ===
																															  "icon-list"
																															? (e(),
																															  n(
																																	t(
																																		z
																																	),
																																	{
																																		key: 2,
																																		class: "h-4 w-4 text-gray-900 stroke-1 mr-2",
																																	}
																															  ))
																															: V(
																																	"",
																																	!0
																															  ),
																														B(
																															" " +
																																k(
																																	a.title
																																),
																															1
																														),
																													]
																												),
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
																					),
																				]
																			)
																		)
																	),
																	128
																)),
															]),
															_: 2,
														},
														1024
													),
												]),
												_: 2,
											},
											1032,
											["defaultOpen"]
										)
									)
								),
								128
							)),
						]),
					])
				);
			};
		},
	};
export { j as C, D as _ };
//# sourceMappingURL=CourseOutline-7cUm8E8p.js.map
