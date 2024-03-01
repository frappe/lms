import {
	af as M,
	r as B,
	k as H,
	x as t,
	y as n,
	K as e,
	H as r,
	L as l,
	M as k,
	Q as x,
	R as g,
	F as u,
	G as i,
	J as d,
	I as v,
	ag as I,
	U as O,
	ah as R,
	ai as V,
	X as F,
} from "./frappe-ui-LT4YqXtx.js";
import { a as h } from "./index-6k1S_EjG.js";
import { F as L } from "./file-text-w2g11TfY.js";
/**
 * @license lucide-vue-next v0.309.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const q = h("ChevronRightIcon", [
	["path", { d: "m9 18 6-6-6-6", key: "mthhwq" }],
]);
/**
 * @license lucide-vue-next v0.309.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const j = h("HelpCircleIcon", [
	["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
	["path", { d: "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3", key: "1u773s" }],
	["path", { d: "M12 17h.01", key: "p32p05" }],
]);
/**
 * @license lucide-vue-next v0.309.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const z = h("MonitorPlayIcon", [
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
	P = { class: "text-base" },
	Q = { key: 0, class: "flex justify-between mb-4" },
	S = { class: "text-2xl font-semibold" },
	T = { class: "text-base text-left font-medium" },
	D = { class: "ml-auto text-sm" },
	E = { class: "outline-lesson py-2 pl-8" },
	G = { class: "flex items-center text-sm" },
	Z = {
		__name: "CourseOutline",
		props: {
			courseName: { type: String, required: !0 },
			showOutline: { type: Boolean, default: !1 },
			showHeader: { type: Boolean, default: !1 },
		},
		setup(c) {
			const w = M();
			B(!0);
			const p = c,
				m = H({
					url: "lms.lms.utils.get_course_outline",
					cache: ["course_outline", p.courseName],
					params: { course: p.courseName },
					auto: !0,
				}),
				C = (a) => a == w.params.chapterNumber || a == 1;
			return (a, J) => {
				var y, f;
				const N = F("router-link");
				return (
					t(),
					n("div", P, [
						c.showHeader && (y = e(m).data) != null && y.length
							? (t(),
							  n("div", Q, [
									r("div", S, l(a.__("Course Content")), 1),
							  ]))
							: k("", !0),
						r(
							"div",
							{
								class: v({
									"shadow rounded-md pt-2 px-2":
										c.showOutline &&
										((f = e(m).data) == null
											? void 0
											: f.length),
								}),
							},
							[
								(t(!0),
								n(
									x,
									null,
									g(
										e(m).data,
										(o, b) => (
											t(),
											u(
												e(V),
												{
													key: o.name,
													defaultOpen: C(o.idx),
												},
												{
													default: i(
														({ open: _ }) => [
															d(
																e(I),
																{
																	ref_for: !0,
																	ref: "",
																	class: "flex w-full px-2 py-4",
																},
																{
																	default: i(
																		() => [
																			d(
																				e(
																					q
																				),
																				{
																					class: v(
																						[
																							{
																								"rotate-90 transform duration-200":
																									_,
																								"duration-200":
																									!_,
																								open:
																									b ==
																									1,
																							},
																							"h-4 w-4 text-gray-900 stroke-1 mr-2",
																						]
																					),
																				},
																				null,
																				8,
																				[
																					"class",
																				]
																			),
																			r(
																				"div",
																				T,
																				l(
																					o.title
																				),
																				1
																			),
																			r(
																				"div",
																				D,
																				l(
																					o
																						.lessons
																						.length
																				) +
																					" " +
																					l(
																						o
																							.lessons
																							.length ==
																							1
																							? a.__(
																									"lesson"
																							  )
																							: a.__(
																									"lessons"
																							  )
																					),
																				1
																			),
																		]
																	),
																	_: 2,
																},
																1536
															),
															d(
																e(R),
																{
																	class: "pb-2",
																},
																{
																	default: i(
																		() => [
																			(t(
																				!0
																			),
																			n(
																				x,
																				null,
																				g(
																					o.lessons,
																					(
																						s
																					) => (
																						t(),
																						n(
																							"div",
																							{
																								key: s.name,
																							},
																							[
																								r(
																									"div",
																									E,
																									[
																										d(
																											N,
																											{
																												to: {
																													name: "Lesson",
																													params: {
																														courseName:
																															c.courseName,
																														chapterNumber:
																															s.number.split(
																																"."
																															)[0],
																														lessonNumber:
																															s.number.split(
																																"."
																															)[1],
																													},
																												},
																											},
																											{
																												default:
																													i(
																														() => [
																															r(
																																"div",
																																G,
																																[
																																	s.icon ===
																																	"icon-youtube"
																																		? (t(),
																																		  u(
																																				e(
																																					z
																																				),
																																				{
																																					key: 0,
																																					class: "h-4 w-4 text-gray-900 stroke-1 mr-2",
																																				}
																																		  ))
																																		: s.icon ===
																																		  "icon-quiz"
																																		? (t(),
																																		  u(
																																				e(
																																					j
																																				),
																																				{
																																					key: 1,
																																					class: "h-4 w-4 text-gray-900 stroke-1 mr-2",
																																				}
																																		  ))
																																		: s.icon ===
																																		  "icon-list"
																																		? (t(),
																																		  u(
																																				e(
																																					L
																																				),
																																				{
																																					key: 2,
																																					class: "h-4 w-4 text-gray-900 stroke-1 mr-2",
																																				}
																																		  ))
																																		: k(
																																				"",
																																				!0
																																		  ),
																																	O(
																																		" " +
																																			l(
																																				s.title
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
																		]
																	),
																	_: 2,
																},
																1024
															),
														]
													),
													_: 2,
												},
												1032,
												["defaultOpen"]
											)
										)
									),
									128
								)),
							],
							2
						),
					])
				);
			};
		},
	};
export { q as C, Z as _ };
//# sourceMappingURL=CourseOutline-AirCiy-C.js.map
