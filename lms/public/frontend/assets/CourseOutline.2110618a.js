import {
	a8 as C,
	k as b,
	P as N,
	s as e,
	u as o,
	A as r,
	K as d,
	L as h,
	y as n,
	z as c,
	C as l,
	D as t,
	a9 as w,
	B as M,
	E as _,
	aa as V,
	F as z,
	X as B,
	ab as I,
} from "./frappe-ui.a747cf9c.js";
import { c as i } from "./index.51e5b051.js";
const L = i("ChevronRightIcon", [
		["path", { d: "m9 18 6-6-6-6", key: "mthhwq" }],
	]),
	F = i("FileTextIcon", [
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
	]),
	O = i("HelpCircleIcon", [
		["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
		["path", { d: "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3", key: "1u773s" }],
		["path", { d: "M12 17h.01", key: "p32p05" }],
	]),
	R = i("MonitorPlayIcon", [
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
	]);
const j = { class: "course-outline text-base" },
	q = { class: "mt-4" },
	H = { class: "text-base" },
	P = { class: "outline-lesson mb-2 pl-9" },
	T = { class: "flex items-center text-sm" },
	X = {
		__name: "CourseOutline",
		props: { courseName: { type: String, required: !0 } },
		setup(m) {
			const k = C(),
				y = m,
				x = b({
					url: "lms.lms.utils.get_course_outline",
					cache: ["course_outline", y.courseName],
					params: { course: y.courseName },
					auto: !0,
				}),
				v = (u) => u == k.params.chapterNumber || u == 1;
			return (u, D) => {
				const f = N("router-link");
				return (
					e(),
					o("div", j, [
						r("div", q, [
							(e(!0),
							o(
								d,
								null,
								h(
									t(x).data,
									(a, g) => (
										e(),
										n(
											t(I),
											{
												key: a.name,
												defaultOpen: v(a.idx),
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
																	t(L),
																	{
																		class: M(
																			[
																				{
																					"rotate-90 transform duration-200":
																						p,
																					"duration-200":
																						!p,
																					open:
																						g ==
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
																	H,
																	_(a.title),
																	1
																),
															]),
															_: 2,
														},
														1024
													),
													l(
														t(V),
														{ class: "pb-2" },
														{
															default: c(() => [
																(e(!0),
																o(
																	d,
																	null,
																	h(
																		a.lessons,
																		(s) => (
																			e(),
																			o(
																				"div",
																				{
																					key: s.name,
																				},
																				[
																					r(
																						"div",
																						P,
																						[
																							l(
																								f,
																								{
																									to: {
																										name: "Lesson",
																										params: {
																											courseName:
																												m.courseName,
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
																										c(
																											() => [
																												r(
																													"div",
																													T,
																													[
																														s.icon ===
																														"icon-youtube"
																															? (e(),
																															  n(
																																	t(
																																		R
																																	),
																																	{
																																		key: 0,
																																		class: "h-4 w-4 text-gray-900 stroke-1 mr-2",
																																	}
																															  ))
																															: s.icon ===
																															  "icon-quiz"
																															? (e(),
																															  n(
																																	t(
																																		O
																																	),
																																	{
																																		key: 1,
																																		class: "h-4 w-4 text-gray-900 stroke-1 mr-2",
																																	}
																															  ))
																															: s.icon ===
																															  "icon-list"
																															? (e(),
																															  n(
																																	t(
																																		F
																																	),
																																	{
																																		key: 2,
																																		class: "h-4 w-4 text-gray-900 stroke-1 mr-2",
																																	}
																															  ))
																															: z(
																																	"",
																																	!0
																															  ),
																														B(
																															" " +
																																_(
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
export { L as C, X as _ };
