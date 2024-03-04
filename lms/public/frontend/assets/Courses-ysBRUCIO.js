import {
	d as k,
	a5 as w,
	r as L,
	j as o,
	y as u,
	H as c,
	J as m,
	K as n,
	G as d,
	F as p,
	M as g,
	Q as N,
	W as V,
	x as l,
	a6 as $,
	a4 as h,
	L as f,
	a7 as j,
	I as B,
	P as D,
	a8 as P,
	R,
	a9 as U,
} from "./frappe-ui-n1bXVQkV.js";
import { _ as z } from "./CourseCard-I7Cj-Ne7.js";
import { P as E } from "./plus-w56hNznP.js";
import "./UserAvatar-3mSOKoKa.js";
import "./index-xt-hKVBz.js";
import "./star-O1ih2gFp.js";
const F = {
		class: "sticky top-0 z-10 flex items-center justify-between border-b bg-white px-3 py-2.5 sm:px-5",
	},
	I = { class: "flex" },
	M = { key: 0 },
	S = { key: 0, class: "p-5 text-base text-gray-700" },
	A = {
		key: 0,
		class: "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 my-5 mx-5",
	},
	G = {
		key: 1,
		class: "grid flex-1 place-items-center text-xl font-medium text-gray-500",
	},
	H = { class: "flex flex-col items-center justify-center mt-4" },
	X = {
		__name: "Courses",
		setup(J) {
			var v, y, x;
			const i = k("$user"),
				a = w({
					type: "list",
					doctype: "LMS Course",
					cache: [
						"courses",
						(v = i == null ? void 0 : i.data) == null
							? void 0
							: v.email,
					],
					url: "lms.lms.utils.get_courses",
					auto: !0,
				}),
				b = L(0),
				_ = [
					{
						label: "Live",
						courses: o(() => {
							var e;
							return (
								((e = a.data) == null ? void 0 : e.live) || []
							);
						}),
						count: o(() => {
							var e, s;
							return (s =
								(e = a.data) == null ? void 0 : e.live) == null
								? void 0
								: s.length;
						}),
					},
					{
						label: "Upcoming",
						courses: o(() => {
							var e;
							return (e = a.data) == null ? void 0 : e.upcoming;
						}),
						count: o(() => {
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
					(_.push({
						label: "Enrolled",
						courses: o(() => {
							var e;
							return (e = a.data) == null ? void 0 : e.enrolled;
						}),
						count: o(() => {
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
						_.push({
							label: "Created",
							courses: o(() => {
								var e;
								return (e = a.data) == null
									? void 0
									: e.created;
							}),
							count: o(() => {
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
						_.push({
							label: "Under Review",
							courses: o(() => {
								var e;
								return (e = a.data) == null
									? void 0
									: e.under_review;
							}),
							count: o(() => {
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
					const C = V("router-link");
					return (
						l(),
						u(
							N,
							null,
							[
								c("header", F, [
									m(
										n($),
										{
											class: "h-7",
											items: [
												{
													label: e.__("All Courses"),
													route: { name: "Courses" },
												},
											],
										},
										null,
										8,
										["items"]
									),
									c("div", I, [
										m(
											C,
											{
												to: {
													name: "CreateCourse",
													params: {
														courseName: "new",
													},
												},
											},
											{
												default: d(() => {
													var t;
													return [
														(t = n(i).data) !=
															null &&
														t.is_moderator
															? (l(),
															  p(
																	n(j),
																	{
																		key: 0,
																		variant:
																			"solid",
																	},
																	{
																		prefix: d(
																			() => [
																				m(
																					n(
																						E
																					),
																					{
																						class: "h-4 w-4",
																					}
																				),
																			]
																		),
																		default:
																			d(
																				() => [
																					h(
																						" " +
																							f(
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
															: g("", !0),
													];
												}),
												_: 1,
											}
										),
									]),
								]),
								n(a).data
									? (l(),
									  u("div", M, [
											n(a).data.length == 0 &&
											n(a).list.loading
												? (l(),
												  u(
														"div",
														S,
														" Loading Courses... "
												  ))
												: (l(),
												  p(
														n(U),
														{
															key: 1,
															modelValue: b.value,
															"onUpdate:modelValue":
																s[0] ||
																(s[0] = (t) =>
																	(b.value =
																		t)),
															tabs: _,
															tablistClass:
																"overflow-x-visible",
														},
														{
															tab: d(
																({
																	tab: t,
																	selected: r,
																}) => [
																	c(
																		"div",
																		null,
																		[
																			c(
																				"button",
																				{
																					class: B(
																						[
																							"group -mb-px flex items-center gap-2 overflow-hidden border-b border-transparent py-2.5 text-base text-gray-600 duration-300 ease-in-out hover:border-gray-400 hover:text-gray-900",
																							{
																								"text-gray-900":
																									r,
																							},
																						]
																					),
																				},
																				[
																					t.icon
																						? (l(),
																						  p(
																								D(
																									t.icon
																								),
																								{
																									key: 0,
																									class: "h-5",
																								}
																						  ))
																						: g(
																								"",
																								!0
																						  ),
																					h(
																						" " +
																							f(
																								e.__(
																									t.label
																								)
																							) +
																							" ",
																						1
																					),
																					m(
																						n(
																							P
																						),
																						{
																							theme: "gray",
																						},
																						{
																							default:
																								d(
																									() => [
																										h(
																											f(
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
															default: d(
																({
																	tab: t,
																}) => [
																	t.courses &&
																	t.courses
																		.value
																		.length
																		? (l(),
																		  u(
																				"div",
																				A,
																				[
																					(l(
																						!0
																					),
																					u(
																						N,
																						null,
																						R(
																							t
																								.courses
																								.value,
																							(
																								r
																							) => (
																								l(),
																								p(
																									C,
																									{
																										to:
																											r.membership &&
																											r.current_lesson
																												? {
																														name: "Lesson",
																														params: {
																															courseName:
																																r.name,
																															chapterNumber:
																																r.current_lesson.split(
																																	"."
																																)[0],
																															lessonNumber:
																																r.current_lesson.split(
																																	"."
																																)[1],
																														},
																												  }
																												: r.membership
																												? {
																														name: "Lesson",
																														params: {
																															courseName:
																																r.name,
																															chapterNumber: 1,
																															lessonNumber: 1,
																														},
																												  }
																												: {
																														name: "CourseDetail",
																														params: {
																															courseName:
																																r.name,
																														},
																												  },
																									},
																									{
																										default:
																											d(
																												() => [
																													m(
																														z,
																														{
																															course: r,
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
																		  u(
																				"div",
																				G,
																				[
																					c(
																						"div",
																						H,
																						[
																							c(
																								"div",
																								null,
																								f(
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
									  ]))
									: g("", !0),
							],
							64
						)
					);
				}
			);
		},
	};
export { X as default };
//# sourceMappingURL=Courses-ysBRUCIO.js.map
