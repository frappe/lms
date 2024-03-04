var P = Object.defineProperty;
var L = Object.getOwnPropertySymbols;
var W = Object.prototype.hasOwnProperty,
	A = Object.prototype.propertyIsEnumerable;
var z = (a, n, e) =>
		n in a
			? P(a, n, {
					enumerable: !0,
					configurable: !0,
					writable: !0,
					value: e,
			  })
			: (a[n] = e),
	T = (a, n) => {
		for (var e in n || (n = {})) W.call(n, e) && z(a, e, n[e]);
		if (L) for (var e of L(n)) A.call(n, e) && z(a, e, n[e]);
		return a;
	};
import {
	C as F,
	d as j,
	j as E,
	x as o,
	y as d,
	M as v,
	H as s,
	L as r,
	F as b,
	G as w,
	J as m,
	K as t,
	a7 as k,
	k as $,
	W as G,
	r as O,
	Q as x,
	R,
	I as M,
	aa as I,
	ab as C,
	a as J,
	ac as K,
	D as Q,
	a4 as V,
	b as B,
	a6 as X,
	T as U,
	a8 as Y,
} from "./frappe-ui-n1bXVQkV.js";
import { B as Z, U as q, c as S } from "./index-xt-hKVBz.js";
import { S as N } from "./star-O1ih2gFp.js";
import { _ as ee } from "./CourseOutline-mDbSZeRP.js";
import { _ as D } from "./UserAvatar-3mSOKoKa.js";
import "./file-text-dAqD9clk.js";
const te = { class: "shadow rounded-md min-w-80" },
	se = ["src"],
	ae = { class: "p-5" },
	re = { key: 0, class: "text-2xl font-semibold mb-3" },
	oe = { class: "mt-8 mb-4 font-medium" },
	le = { class: "flex items-center mb-3" },
	ne = { class: "ml-2" },
	ie = { class: "flex items-center mb-3" },
	ue = { class: "ml-2" },
	de = { class: "flex items-center" },
	ce = { class: "ml-2" },
	me = {
		__name: "CourseCardOverlay",
		props: { course: { type: Object, default: null } },
		setup(a) {
			const n = F(),
				e = j("$user"),
				_ = a,
				l = E(() =>
					_.course.data.video_link
						? "https://www.youtube.com/embed/" +
						  _.course.data.video_link
						: null
				);
			function p() {
				if (!e.data)
					S({
						title: "Please Login",
						icon: "alert-circle",
						iconClasses: "text-yellow-600 bg-yellow-100",
					}),
						setTimeout(() => {
							window.location.href = `/login?redirect-to=${window.location.pathname}`;
						}, 3e3);
				else {
					const i = $({
						url: "lms.lms.doctype.lms_enrollment.lms_enrollment.create_membership",
					});
					console.log(_.course),
						i.submit({ course: _.course.data.name }).then(() => {
							S({
								title: "Enrolled Successfully",
								icon: "check",
								iconClasses: "text-green-600 bg-green-100",
							}),
								setTimeout(() => {
									n.push({
										name: "Lesson",
										params: {
											courseName: _.course.data.name,
											chapterNumber: 1,
											lessonNumber: 1,
										},
									});
								}, 3e3);
						});
				}
			}
			const g = () => {};
			return (i, f) => {
				var c, y;
				const u = G("router-link");
				return (
					o(),
					d("div", te, [
						a.course.data.video_link
							? (o(),
							  d(
									"iframe",
									{
										key: 0,
										src: l.value,
										class: "rounded-t-md min-h-56 min-w-80",
									},
									null,
									8,
									se
							  ))
							: v("", !0),
						s("div", ae, [
							a.course.data.price
								? (o(), d("div", re, r(a.course.data.price), 1))
								: v("", !0),
							a.course.data.membership
								? (o(),
								  b(
										u,
										{
											key: 1,
											to: {
												name: "Lesson",
												params: {
													courseName: a.course.name,
													chapterNumber: a.course.data
														.current_lesson
														? a.course.data.current_lesson.split(
																"."
														  )[0]
														: 1,
													lessonNumber: a.course.data
														.current_lesson
														? a.course.data.current_lesson.split(
																"."
														  )[1]
														: 1,
												},
											},
										},
										{
											default: w(() => [
												m(
													t(k),
													{
														variant: "solid",
														size: "md",
														class: "w-full",
													},
													{
														default: w(() => [
															s(
																"span",
																null,
																r(
																	i.__(
																		"Continue Learning"
																	)
																),
																1
															),
														]),
														_: 1,
													}
												),
											]),
											_: 1,
										},
										8,
										["to"]
								  ))
								: a.course.data.paid_course
								? (o(),
								  b(
										u,
										{
											key: 2,
											to: {
												name: "Billing",
												params: {
													type: "course",
													name: a.course.data.name,
												},
											},
										},
										{
											default: w(() => [
												m(
													t(k),
													{
														variant: "solid",
														size: "md",
														class: "w-full",
													},
													{
														default: w(() => [
															s(
																"span",
																null,
																r(
																	i.__(
																		"Buy this course"
																	)
																),
																1
															),
														]),
														_: 1,
													}
												),
											]),
											_: 1,
										},
										8,
										["to"]
								  ))
								: (o(),
								  b(
										t(k),
										{
											key: 3,
											onClick:
												f[0] || (f[0] = (h) => p()),
											variant: "solid",
											class: "w-full",
											size: "md",
										},
										{
											default: w(() => [
												s(
													"span",
													null,
													r(i.__("Start Learning")),
													1
												),
											]),
											_: 1,
										}
								  )),
							((y = (c = t(e)) == null ? void 0 : c.data) !=
								null &&
								y.is_moderator) ||
							g()
								? (o(),
								  b(
										u,
										{
											key: 4,
											to: {
												name: "CreateCourse",
												params: {
													courseName:
														a.course.data.name,
												},
											},
										},
										{
											default: w(() => [
												m(
													t(k),
													{
														variant: "subtle",
														class: "w-full mt-2",
														size: "md",
													},
													{
														default: w(() => [
															s(
																"span",
																null,
																r(i.__("Edit")),
																1
															),
														]),
														_: 1,
													}
												),
											]),
											_: 1,
										},
										8,
										["to"]
								  ))
								: v("", !0),
							s("div", oe, r(i.__("This course has:")), 1),
							s("div", le, [
								m(t(Z), {
									class: "h-5 w-5 stroke-1.5 text-gray-600",
								}),
								s(
									"span",
									ne,
									r(a.course.data.lesson_count) +
										" " +
										r(i.__("Lessons")),
									1
								),
							]),
							s("div", ie, [
								m(t(q), {
									class: "h-5 w-5 stroke-1.5 text-gray-600",
								}),
								s(
									"span",
									ue,
									r(
										a.course.data.enrollment_count_formatted
									) +
										" " +
										r(i.__("Enrolled Students")),
									1
								),
							]),
							s("div", de, [
								m(t(N), {
									class: "h-5 w-5 stroke-1.5 fill-orange-500 text-gray-50",
								}),
								s(
									"span",
									ce,
									r(a.course.data.avg_rating) +
										" " +
										r(i.__("Rating")),
									1
								),
							]),
						]),
					])
				);
			};
		},
	},
	_e = { class: "flex text-center" },
	ve = {
		__name: "Rating",
		props: {
			id: { type: String, default: "" },
			modelValue: { type: Number, default: 0 },
		},
		emits: ["update:modelValue"],
		setup(a, { emit: n }) {
			const e = a,
				_ = n;
			let l = O(e.modelValue),
				p = (i) => {
					_("update:modelValue", i);
				};
			function g(i) {
				p(i), (l.value = i);
			}
			return (i, f) => (
				o(),
				d("div", _e, [
					(o(),
					d(
						x,
						null,
						R(5, (u) =>
							s("div", null, [
								m(
									t(N),
									{
										class: M([
											u <= t(l) ? "fill-orange-500" : "",
											"h-6 w-6 fill-gray-400 text-gray-50 mr-1 cursor-pointer",
										]),
										onClick: (c) => g(u),
									},
									null,
									8,
									["class", "onClick"]
								),
							])
						),
						64
					)),
				])
			);
		},
	},
	ge = { class: "flex flex-col gap-4" },
	fe = { class: "mb-1.5 text-sm text-gray-600" },
	he = { class: "mb-1.5 text-sm text-gray-600" },
	pe = {
		__name: "ReviewModal",
		props: I(
			{ courseName: { type: String, required: !0 } },
			{
				modelValue: {},
				modelModifiers: {},
				reloadReviews: {},
				reloadReviewsModifiers: {},
				hasReviewed: {},
				hasReviewedModifiers: {},
			}
		),
		emits: [
			"update:modelValue",
			"update:reloadReviews",
			"update:hasReviewed",
		],
		setup(a) {
			const n = C(a, "modelValue"),
				e = C(a, "reloadReviews"),
				_ = C(a, "hasReviewed");
			let l = J({ review: "", rating: 0 });
			const p = a,
				g = $({
					url: "frappe.client.insert",
					makeParams(f) {
						return {
							doc: T(
								{
									doctype: "LMS Course Review",
									course: p.courseName,
								},
								f
							),
						};
					},
				});
			function i(f) {
				(l.rating = l.rating / 5),
					g.submit(l, {
						validate() {
							if (!l.rating) return "Please enter a rating.";
						},
						onSuccess() {
							e.value.reload(), _.value.reload();
						},
						onError(u) {
							var c;
							S({
								text:
									((c = u.messages) == null
										? void 0
										: c[0]) || u,
								icon: "x",
								iconClasses: "text-red-600 bg-red-300",
							});
						},
					}),
					f();
			}
			return (f, u) => (
				o(),
				b(
					t(Q),
					{
						modelValue: n.value,
						"onUpdate:modelValue":
							u[2] || (u[2] = (c) => (n.value = c)),
						options: {
							title: f.__("Write a Review"),
							size: "xl",
							actions: [
								{
									label: "Submit",
									variant: "solid",
									onClick: (c) => i(c),
								},
							],
						},
					},
					{
						"body-content": w(() => [
							s("div", ge, [
								s("div", null, [
									s("div", fe, r(f.__("Rating")), 1),
									m(
										ve,
										{
											modelValue: t(l).rating,
											"onUpdate:modelValue":
												u[0] ||
												(u[0] = (c) =>
													(t(l).rating = c)),
										},
										null,
										8,
										["modelValue"]
									),
								]),
								s("div", null, [
									s("div", he, r(f.__("Review")), 1),
									m(
										t(K),
										{
											type: "text",
											size: "md",
											rows: "5",
											modelValue: t(l).review,
											"onUpdate:modelValue":
												u[1] ||
												(u[1] = (c) =>
													(t(l).review = c)),
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
	we = { key: 0, class: "mt-20 mb-10" },
	ye = { class: "flex items-center font-semibold text-2xl" },
	be = { class: "grid gap-8 mt-10" },
	xe = { class: "flex items-center" },
	ke = { class: "mx-4" },
	$e = { class: "text-lg font-medium mr-4" },
	Re = { class: "flex mt-2" },
	Ne = { key: 0, class: "mt-4 leading-5" },
	Ce = {
		__name: "CourseReviews",
		props: {
			courseName: { type: String, required: !0 },
			avg_rating: { type: Number, required: !0 },
			membership: { type: Object, required: !1 },
		},
		setup(a) {
			var i, f, u;
			const n = j("$user"),
				e = a,
				_ = $({
					url: "frappe.client.get_count",
					cache: [
						"eligible_to_review",
						e.courseName,
						(i = e.membership) == null ? void 0 : i.member,
					],
					params: {
						doctype: "LMS Course Review",
						filters: {
							course: e.courseName,
							owner:
								(f = e.membership) == null ? void 0 : f.member,
						},
					},
					auto: !!((u = n.data) != null && u.name),
				}),
				l = $({
					url: "lms.lms.utils.get_reviews",
					cache: ["course_reviews", e.courseName],
					params: { course: e.courseName },
					auto: !0,
				}),
				p = O(!1);
			function g() {
				p.value = !0;
			}
			return (c, y) => (
				o(),
				d(
					x,
					null,
					[
						t(l).data
							? (o(),
							  d("div", we, [
									a.membership && !t(_).data
										? (o(),
										  b(
												t(k),
												{
													key: 0,
													onClick:
														y[0] ||
														(y[0] = (h) => g()),
													class: "float-right",
												},
												{
													default: w(() => [
														V(
															r(
																c.__(
																	"Write a Review"
																)
															),
															1
														),
													]),
													_: 1,
												}
										  ))
										: v("", !0),
									s("div", ye, [
										m(t(N), {
											class: "h-6 w-6 stroke-1 text-gray-50 fill-orange-500 mr-1",
										}),
										V(
											" " +
												r(a.avg_rating) +
												" " +
												r(c.__("ratings and ")) +
												" " +
												r(t(l).data.length) +
												" " +
												r(c.__("reviews")),
											1
										),
									]),
									s("div", be, [
										(o(!0),
										d(
											x,
											null,
											R(
												t(l).data,
												(h, Je) => (
													o(),
													d("div", null, [
														s("div", xe, [
															m(
																D,
																{
																	user: h.owner_details,
																	size: "2xl",
																},
																null,
																8,
																["user"]
															),
															s("div", ke, [
																s(
																	"span",
																	$e,
																	r(
																		h
																			.owner_details
																			.full_name
																	),
																	1
																),
																s(
																	"span",
																	null,
																	r(
																		h.creation
																	),
																	1
																),
																s("div", Re, [
																	(o(),
																	d(
																		x,
																		null,
																		R(
																			5,
																			(
																				H
																			) =>
																				m(
																					t(
																						N
																					),
																					{
																						class: M(
																							[
																								"h-5 w-5 text-gray-100 bg-gray-200 rounded-sm mr-2",
																								H <=
																								Math.ceil(
																									h.rating
																								)
																									? "fill-orange-500"
																									: "fill-gray-600",
																							]
																						),
																					},
																					null,
																					8,
																					[
																						"class",
																					]
																				)
																		),
																		64
																	)),
																]),
															]),
														]),
														h.review
															? (o(),
															  d(
																	"div",
																	Ne,
																	r(h.review),
																	1
															  ))
															: v("", !0),
													])
												)
											),
											256
										)),
									]),
							  ]))
							: v("", !0),
						m(
							pe,
							{
								modelValue: p.value,
								"onUpdate:modelValue":
									y[1] || (y[1] = (h) => (p.value = h)),
								reloadReviews: t(l),
								"onUpdate:reloadReviews":
									y[2] ||
									(y[2] = (h) =>
										B(l) ? (l.value = h) : null),
								hasReviewed: t(_),
								"onUpdate:hasReviewed":
									y[3] ||
									(y[3] = (h) =>
										B(_) ? (_.value = h) : null),
								courseName: a.courseName,
							},
							null,
							8,
							[
								"modelValue",
								"reloadReviews",
								"hasReviewed",
								"courseName",
							]
						),
					],
					64
				)
			);
		},
	},
	Ve = { key: 0, class: "h-screen text-base" },
	Se = {
		class: "sticky top-0 z-10 flex items-center justify-between border-b bg-white px-3 py-2.5 sm:px-5",
	},
	Me = { class: "m-5" },
	Le = { class: "flex justify-between w-full" },
	ze = { class: "w-2/3" },
	Te = { class: "text-3xl font-semibold" },
	Be = { class: "my-3 leading-6" },
	Ue = { class: "flex items-center" },
	je = { class: "ml-1" },
	Ee = { key: 1, class: "mx-3" },
	Oe = { class: "ml-1" },
	qe = { key: 3, class: "mx-3" },
	De = { class: "flex items-center" },
	He = { key: 0 },
	Pe = { key: 1 },
	We = { key: 2 },
	Ae = { class: "flex mt-3 mb-4 w-fit" },
	Fe = ["innerHTML"],
	Ge = { class: "mt-10" },
	Ie = { class: "" },
	st = {
		__name: "CourseDetail",
		props: { courseName: { type: String, required: !0 } },
		setup(a) {
			const n = a,
				e = $({
					url: "lms.lms.utils.get_course_details",
					cache: ["course", n.courseName],
					params: { course: n.courseName },
					auto: !0,
				}),
				_ = E(() => {
					var p, g;
					let l = [
						{ label: "All Courses", route: { name: "Courses" } },
					];
					return (
						l.push({
							label:
								(p = e == null ? void 0 : e.data) == null
									? void 0
									: p.title,
							route: {
								name: "CourseDetail",
								params: {
									course:
										(g = e == null ? void 0 : e.data) ==
										null
											? void 0
											: g.name,
								},
							},
						}),
						l
					);
				});
			return (l, p) =>
				t(e).data
					? (o(),
					  d("div", Ve, [
							s("header", Se, [
								m(
									t(X),
									{ class: "h-7", items: _.value },
									null,
									8,
									["items"]
								),
							]),
							s("div", Me, [
								s("div", Le, [
									s("div", ze, [
										s("div", Te, r(t(e).data.title), 1),
										s(
											"div",
											Be,
											r(t(e).data.short_introduction),
											1
										),
										s("div", Ue, [
											t(e).data.avg_rating
												? (o(),
												  b(
														t(U),
														{
															key: 0,
															text: l.__(
																"Average Rating"
															),
															class: "flex items-center",
														},
														{
															default: w(() => [
																m(t(N), {
																	class: "h-5 w-5 text-gray-100 fill-orange-500",
																}),
																s(
																	"span",
																	je,
																	r(
																		t(e)
																			.data
																			.avg_rating
																	),
																	1
																),
															]),
															_: 1,
														},
														8,
														["text"]
												  ))
												: v("", !0),
											t(e).data.avg_rating
												? (o(), d("span", Ee, "·"))
												: v("", !0),
											t(e).data.enrollment_count
												? (o(),
												  b(
														t(U),
														{
															key: 2,
															text: l.__(
																"Enrolled Students"
															),
															class: "flex items-center",
														},
														{
															default: w(() => [
																m(t(q), {
																	class: "h-4 w-4 text-gray-700",
																}),
																s(
																	"span",
																	Oe,
																	r(
																		t(e)
																			.data
																			.enrollment_count_formatted
																	),
																	1
																),
															]),
															_: 1,
														},
														8,
														["text"]
												  ))
												: v("", !0),
											t(e).data.enrollment_count
												? (o(), d("span", qe, "·"))
												: v("", !0),
											s("div", De, [
												s(
													"span",
													{
														class: M([
															"mr-1",
															{
																"avatar-group overlap":
																	t(e).data
																		.instructors
																		.length >
																	1,
															},
														]),
													},
													[
														(o(!0),
														d(
															x,
															null,
															R(
																t(e).data
																	.instructors,
																(g) => (
																	o(),
																	b(
																		D,
																		{
																			user: g,
																		},
																		null,
																		8,
																		["user"]
																	)
																)
															),
															256
														)),
													],
													2
												),
												t(e).data.instructors.length ==
												1
													? (o(),
													  d(
															"span",
															He,
															r(
																t(e).data
																	.instructors[0]
																	.full_name
															),
															1
													  ))
													: v("", !0),
												t(e).data.instructors.length ==
												2
													? (o(),
													  d(
															"span",
															Pe,
															r(
																t(e).data
																	.instructors[0]
																	.first_name
															) +
																" and " +
																r(
																	t(e).data
																		.instructors[1]
																		.first_name
																),
															1
													  ))
													: v("", !0),
												t(e).data.instructors.length > 2
													? (o(),
													  d(
															"span",
															We,
															r(
																t(e).data
																	.instructors[0]
																	.first_name
															) +
																" and " +
																r(
																	t(e).data
																		.instructors
																		.length -
																		1
																) +
																" others ",
															1
													  ))
													: v("", !0),
											]),
										]),
										s("div", Ae, [
											(o(!0),
											d(
												x,
												null,
												R(
													t(e).data.tags,
													(g) => (
														o(),
														b(
															t(Y),
															{
																theme: "gray",
																size: "lg",
																class: "mr-2",
															},
															{
																default: w(
																	() => [
																		V(
																			r(
																				g
																			),
																			1
																		),
																	]
																),
																_: 2,
															},
															1024
														)
													)
												),
												256
											)),
										]),
										s(
											"div",
											{
												innerHTML:
													t(e).data.description,
												class: "course-description",
											},
											null,
											8,
											Fe
										),
										s("div", Ge, [
											m(
												ee,
												{
													courseName: t(e).data.name,
													showOutline: !0,
													title: "Course Outline",
												},
												null,
												8,
												["courseName"]
											),
										]),
										t(e).data.avg_rating
											? (o(),
											  b(
													Ce,
													{
														key: 0,
														courseName:
															t(e).data.name,
														avg_rating:
															t(e).data
																.avg_rating,
														membership:
															t(e).data
																.membership,
													},
													null,
													8,
													[
														"courseName",
														"avg_rating",
														"membership",
													]
											  ))
											: v("", !0),
									]),
									s("div", Ie, [
										m(me, { course: t(e) }, null, 8, [
											"course",
										]),
									]),
								]),
							]),
					  ]))
					: v("", !0);
		},
	};
export { st as default };
//# sourceMappingURL=CourseDetail-V5AjKcOc.js.map
