import {
	d as k,
	a5 as w,
	r as L,
	j as r,
	y as c,
	H as n,
	C as d,
	G as _,
	A as p,
	B as u,
	J as f,
	x as l,
	a6 as V,
	U as g,
	I as h,
	a7 as $,
	F as B,
	N as j,
	a8 as U,
	Q as D,
	R,
	a9 as z,
	X as A,
} from "./frappe-ui-20hnMCM8.js";
import { _ as E } from "./CourseCard--twQpeIf.js";
import { P as F } from "./plus-pxSjkL_w.js";
import "./UserAvatar-yrWInUTi.js";
import "./index-Vx7mSx23.js";
import "./star-ypmGZNF0.js";
const I = { class: "h-screen" },
	P = { key: 0 },
	S = {
		class: "sticky top-0 z-10 flex items-center justify-between border-b bg-white px-3 py-2.5 sm:px-5",
	},
	G = { class: "flex" },
	H = { class: "" },
	J = { key: 0, class: "p-5 text-base text-gray-700" },
	M = {
		key: 0,
		class: "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 my-5 mx-5",
	},
	Q = {
		key: 1,
		class: "grid flex-1 place-items-center text-xl font-medium text-gray-500",
	},
	T = { class: "flex flex-col items-center justify-center mt-4" },
	ee = {
		__name: "Courses",
		setup(X) {
			var b, y, x;
			const i = k("$user"),
				a = w({
					type: "list",
					doctype: "LMS Course",
					cache: [
						"courses",
						(b = i == null ? void 0 : i.data) == null
							? void 0
							: b.email,
					],
					url: "lms.lms.utils.get_courses",
					auto: !0,
				}),
				v = L(0),
				m = [
					{
						label: "Live",
						courses: r(() => {
							var e;
							return (
								((e = a.data) == null ? void 0 : e.live) || []
							);
						}),
						count: r(() => {
							var e, s;
							return (s =
								(e = a.data) == null ? void 0 : e.live) == null
								? void 0
								: s.length;
						}),
					},
					{
						label: "Upcoming",
						courses: r(() => {
							var e;
							return (e = a.data) == null ? void 0 : e.upcoming;
						}),
						count: r(() => {
							var e, s;
							return (s =
								(e = a.data) == null ? void 0 : e.upcoming) ==
								null
								? void 0
								: s.length;
						}),
					},
				];
			return (
				i.data &&
					(m.push({
						label: "Enrolled",
						courses: r(() => {
							var e;
							return (e = a.data) == null ? void 0 : e.enrolled;
						}),
						count: r(() => {
							var e, s;
							return (s =
								(e = a.data) == null ? void 0 : e.enrolled) ==
								null
								? void 0
								: s.length;
						}),
					}),
					(i.data.is_moderator ||
						i.data.is_instructor ||
						((x = (y = a.data) == null ? void 0 : y.created) !=
							null &&
							x.length)) &&
						m.push({
							label: "Created",
							courses: r(() => {
								var e;
								return (e = a.data) == null
									? void 0
									: e.created;
							}),
							count: r(() => {
								var e, s;
								return (s =
									(e = a.data) == null
										? void 0
										: e.created) == null
									? void 0
									: s.length;
							}),
						}),
					i.data.is_moderator &&
						m.push({
							label: "Under Review",
							courses: r(() => {
								var e;
								return (e = a.data) == null
									? void 0
									: e.under_review;
							}),
							count: r(() => {
								var e, s;
								return (s =
									(e = a.data) == null
										? void 0
										: e.under_review) == null
									? void 0
									: s.length;
							}),
						})),
				(e, s) => {
					var C;
					const N = A("router-link");
					return (
						l(),
						c("div", I, [
							n(a).data
								? (l(),
								  c("div", P, [
										d("header", S, [
											_(
												n(V),
												{
													class: "h-7",
													items: [
														{
															label: e.__(
																"All Courses"
															),
															route: {
																name: "Courses",
															},
														},
													],
												},
												null,
												8,
												["items"]
											),
											d("div", G, [
												(C = n(i).data) != null &&
												C.is_moderator
													? (l(),
													  p(
															n($),
															{
																key: 0,
																variant:
																	"solid",
															},
															{
																prefix: u(
																	() => [
																		_(
																			n(
																				F
																			),
																			{
																				class: "h-4 w-4",
																			}
																		),
																	]
																),
																default: u(
																	() => [
																		g(
																			" " +
																				h(
																					e.__(
																						"New Course"
																					)
																				),
																			1
																		),
																	]
																),
																_: 1,
															}
													  ))
													: f("", !0),
											]),
										]),
										d("div", H, [
											n(a).data.length == 0 &&
											n(a).list.loading
												? (l(),
												  c(
														"div",
														J,
														" Loading Courses... "
												  ))
												: (l(),
												  p(
														n(z),
														{
															key: 1,
															modelValue: v.value,
															"onUpdate:modelValue":
																s[0] ||
																(s[0] = (t) =>
																	(v.value =
																		t)),
															tabs: m,
															tablistClass:
																"overflow-x-visible",
														},
														{
															tab: u(
																({
																	tab: t,
																	selected: o,
																}) => [
																	d(
																		"div",
																		null,
																		[
																			d(
																				"button",
																				{
																					class: B(
																						[
																							"group -mb-px flex items-center gap-2 overflow-hidden border-b border-transparent py-2.5 text-base text-gray-600 duration-300 ease-in-out hover:border-gray-400 hover:text-gray-900",
																							{
																								"text-gray-900":
																									o,
																							},
																						]
																					),
																				},
																				[
																					t.icon
																						? (l(),
																						  p(
																								j(
																									t.icon
																								),
																								{
																									key: 0,
																									class: "h-5",
																								}
																						  ))
																						: f(
																								"",
																								!0
																						  ),
																					g(
																						" " +
																							h(
																								e.__(
																									t.label
																								)
																							) +
																							" ",
																						1
																					),
																					_(
																						n(
																							U
																						),
																						{
																							theme: "gray",
																						},
																						{
																							default:
																								u(
																									() => [
																										g(
																											h(
																												t.count
																											),
																											1
																										),
																									]
																								),
																							_: 2,
																						},
																						1024
																					),
																				],
																				2
																			),
																		]
																	),
																]
															),
															default: u(
																({
																	tab: t,
																}) => [
																	t.courses &&
																	t.courses
																		.value
																		.length
																		? (l(),
																		  c(
																				"div",
																				M,
																				[
																					(l(
																						!0
																					),
																					c(
																						D,
																						null,
																						R(
																							t
																								.courses
																								.value,
																							(
																								o
																							) => (
																								l(),
																								p(
																									N,
																									{
																										to:
																											o.membership &&
																											o.current_lesson
																												? {
																														name: "Lesson",
																														params: {
																															courseName:
																																o.name,
																															chapterNumber:
																																o.current_lesson.split(
																																	"."
																																)[0],
																															lessonNumber:
																																o.current_lesson.split(
																																	"."
																																)[1],
																														},
																												  }
																												: o.membership
																												? {
																														name: "Lesson",
																														params: {
																															courseName:
																																o.name,
																															chapterNumber: 1,
																															lessonNumber: 1,
																														},
																												  }
																												: {
																														name: "CourseDetail",
																														params: {
																															courseName:
																																o.name,
																														},
																												  },
																									},
																									{
																										default:
																											u(
																												() => [
																													_(
																														E,
																														{
																															course: o,
																														},
																														null,
																														8,
																														[
																															"course",
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
																								)
																							)
																						),
																						256
																					)),
																				]
																		  ))
																		: (l(),
																		  c(
																				"div",
																				Q,
																				[
																					d(
																						"div",
																						T,
																						[
																							d(
																								"div",
																								null,
																								h(
																									e
																										.__(
																											"No {0} courses found"
																										)
																										.format(
																											t.label.toLowerCase()
																										)
																								),
																								1
																							),
																						]
																					),
																				]
																		  )),
																]
															),
															_: 1,
														},
														8,
														["modelValue"]
												  )),
										]),
								  ]))
								: f("", !0),
						])
					);
				}
			);
		},
	};
export { ee as default };
//# sourceMappingURL=Courses-twOd7MxD.js.map
