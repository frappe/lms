var A = Object.defineProperty;
var L = Object.getOwnPropertySymbols;
var P = Object.prototype.hasOwnProperty,
	F = Object.prototype.propertyIsEnumerable;
var z = (a, i, e) =>
		i in a
			? A(a, i, {
					enumerable: !0,
					configurable: !0,
					writable: !0,
					value: e,
			  })
			: (a[i] = e),
	B = (a, i) => {
		for (var e in i || (i = {})) P.call(i, e) && z(a, e, i[e]);
		if (L) for (var e of L(i)) F.call(i, e) && z(a, e, i[e]);
		return a;
	};
import {
	L as W,
	d as j,
	j as E,
	x as l,
	y as u,
	J as v,
	C as s,
	I as r,
	A as y,
	B as w,
	G as m,
	H as t,
	a7 as k,
	k as $,
	X as G,
	r as q,
	Q as x,
	R,
	F as M,
	aa as I,
	ab as C,
	a as J,
	ac as Q,
	D as X,
	U as V,
	b as T,
	a6 as K,
	T as U,
	a8 as Y,
} from "./frappe-ui-20hnMCM8.js";
import { B as Z, U as D, c as S } from "./index-Vx7mSx23.js";
import { S as N } from "./star-ypmGZNF0.js";
import { _ as ee } from "./CourseOutline-M5G5Rx7O.js";
import { _ as O } from "./UserAvatar-yrWInUTi.js";
const te = { class: "shadow rounded-md min-w-80" },
	se = ["src"],
	ae = { class: "p-5" },
	re = { key: 0, class: "text-2xl font-semibold mb-3" },
	le = { class: "mt-8 mb-4 font-medium" },
	oe = { class: "flex items-center mb-3" },
	ne = { class: "ml-2" },
	ie = { class: "flex items-center mb-3" },
	ue = { class: "ml-2" },
	de = { class: "flex items-center" },
	ce = { class: "ml-2" },
	me = {
		__name: "CourseCardOverlay",
		props: { course: { type: Object, default: null } },
		setup(a) {
			const i = W(),
				e = j("$user"),
				_ = a,
				o = E(() =>
					_.course.data.video_link
						? "https://www.youtube.com/embed/" +
						  _.course.data.video_link
						: null
				);
			function f() {
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
					const n = $({
						url: "lms.lms.doctype.lms_enrollment.lms_enrollment.create_membership",
					});
					console.log(_.course),
						n.submit({ course: _.course.data.name }).then(() => {
							S({
								title: "Enrolled Successfully",
								icon: "check",
								iconClasses: "text-green-600 bg-green-100",
							}),
								setTimeout(() => {
									i.push({
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
			return (n, h) => {
				var d, c;
				const g = G("router-link");
				return (
					l(),
					u("div", te, [
						a.course.data.video_link
							? (l(),
							  u(
									"iframe",
									{
										key: 0,
										src: o.value,
										class: "rounded-t-md min-h-56 min-w-80",
									},
									null,
									8,
									se
							  ))
							: v("", !0),
						s("div", ae, [
							a.course.data.price
								? (l(), u("div", re, r(a.course.data.price), 1))
								: v("", !0),
							a.course.data.membership
								? (l(),
								  y(
										g,
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
																	n.__(
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
								? (l(),
								  y(
										g,
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
																	n.__(
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
								: (l(),
								  y(
										t(k),
										{
											key: 3,
											onClick:
												h[0] || (h[0] = (b) => f()),
											variant: "solid",
											class: "w-full",
											size: "md",
										},
										{
											default: w(() => [
												s(
													"span",
													null,
													r(n.__("Start Learning")),
													1
												),
											]),
											_: 1,
										}
								  )),
							(c = (d = t(e)) == null ? void 0 : d.data) !=
								null && c.is_moderator
								? (l(),
								  y(
										t(k),
										{
											key: 4,
											variant: "subtle",
											class: "w-full",
											size: "md",
										},
										{
											default: w(() => [
												s(
													"span",
													null,
													r(n.__("Edit")),
													1
												),
											]),
											_: 1,
										}
								  ))
								: v("", !0),
							s("div", le, r(n.__("This course has:")), 1),
							s("div", oe, [
								m(t(Z), {
									class: "h-5 w-5 stroke-1.5 text-gray-600",
								}),
								s(
									"span",
									ne,
									r(a.course.data.lesson_count) +
										" " +
										r(n.__("Lessons")),
									1
								),
							]),
							s("div", ie, [
								m(t(D), {
									class: "h-5 w-5 stroke-1.5 text-gray-600",
								}),
								s(
									"span",
									ue,
									r(
										a.course.data.enrollment_count_formatted
									) +
										" " +
										r(n.__("Enrolled Students")),
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
										r(n.__("Rating")),
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
		setup(a, { emit: i }) {
			const e = a,
				_ = i;
			let o = q(e.modelValue),
				f = (h) => {
					_("update:modelValue", h);
				};
			function n(h) {
				f(h), (o.value = h);
			}
			return (h, g) => (
				l(),
				u("div", _e, [
					(l(),
					u(
						x,
						null,
						R(5, (d) =>
							s("div", null, [
								m(
									t(N),
									{
										class: M([
											d <= t(o) ? "fill-orange-500" : "",
											"h-6 w-6 fill-gray-400 text-gray-50 mr-1 cursor-pointer",
										]),
										onClick: (c) => n(d),
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
			const i = C(a, "modelValue"),
				e = C(a, "reloadReviews"),
				_ = C(a, "hasReviewed");
			let o = J({ review: "", rating: 0 });
			const f = a,
				n = $({
					url: "frappe.client.insert",
					makeParams(g) {
						return {
							doc: B(
								{
									doctype: "LMS Course Review",
									course: f.courseName,
								},
								g
							),
						};
					},
				});
			function h(g) {
				(o.rating = o.rating / 5),
					n.submit(o, {
						validate() {
							if (!o.rating) return "Please enter a rating.";
						},
						onSuccess() {
							e.value.reload(), _.value.reload();
						},
						onError(d) {
							var c;
							S({
								text:
									((c = d.messages) == null
										? void 0
										: c[0]) || d,
								icon: "x",
								iconClasses: "text-red-600 bg-red-300",
							});
						},
					}),
					g();
			}
			return (g, d) => (
				l(),
				y(
					t(X),
					{
						modelValue: i.value,
						"onUpdate:modelValue":
							d[2] || (d[2] = (c) => (i.value = c)),
						options: {
							title: g.__("Write a Review"),
							size: "xl",
							actions: [
								{
									label: "Submit",
									variant: "solid",
									onClick: (c) => h(c),
								},
							],
						},
					},
					{
						"body-content": w(() => [
							s("div", ge, [
								s("div", null, [
									s("div", fe, r(g.__("Rating")), 1),
									m(
										ve,
										{
											modelValue: t(o).rating,
											"onUpdate:modelValue":
												d[0] ||
												(d[0] = (c) =>
													(t(o).rating = c)),
										},
										null,
										8,
										["modelValue"]
									),
								]),
								s("div", null, [
									s("div", he, r(g.__("Review")), 1),
									m(
										t(Q),
										{
											type: "text",
											size: "md",
											rows: "5",
											modelValue: t(o).review,
											"onUpdate:modelValue":
												d[1] ||
												(d[1] = (c) =>
													(t(o).review = c)),
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
			var h, g, d;
			const i = j("$user"),
				e = a,
				_ = $({
					url: "frappe.client.get_count",
					cache: [
						"eligible_to_review",
						e.courseName,
						(h = e.membership) == null ? void 0 : h.member,
					],
					params: {
						doctype: "LMS Course Review",
						filters: {
							course: e.courseName,
							owner:
								(g = e.membership) == null ? void 0 : g.member,
						},
					},
					auto: !!((d = i.data) != null && d.name),
				}),
				o = $({
					url: "lms.lms.utils.get_reviews",
					cache: ["course_reviews", e.courseName],
					params: { course: e.courseName },
					auto: !0,
				}),
				f = q(!1);
			function n() {
				f.value = !0;
			}
			return (c, b) => (
				l(),
				u(
					x,
					null,
					[
						t(o).data
							? (l(),
							  u("div", we, [
									a.membership && !t(_).data
										? (l(),
										  y(
												t(k),
												{
													key: 0,
													onClick:
														b[0] ||
														(b[0] = (p) => n()),
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
												r(t(o).data.length) +
												" " +
												r(c.__("reviews")),
											1
										),
									]),
									s("div", be, [
										(l(!0),
										u(
											x,
											null,
											R(
												t(o).data,
												(p, Je) => (
													l(),
													u("div", null, [
														s("div", xe, [
															m(
																O,
																{
																	user: p.owner_details,
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
																		p
																			.owner_details
																			.full_name
																	),
																	1
																),
																s(
																	"span",
																	null,
																	r(
																		p.creation
																	),
																	1
																),
																s("div", Re, [
																	(l(),
																	u(
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
																									p.rating
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
														p.review
															? (l(),
															  u(
																	"div",
																	Ne,
																	r(p.review),
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
								modelValue: f.value,
								"onUpdate:modelValue":
									b[1] || (b[1] = (p) => (f.value = p)),
								reloadReviews: t(o),
								"onUpdate:reloadReviews":
									b[2] ||
									(b[2] = (p) =>
										T(o) ? (o.value = p) : null),
								hasReviewed: t(_),
								"onUpdate:hasReviewed":
									b[3] ||
									(b[3] = (p) =>
										T(_) ? (_.value = p) : null),
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
	Be = { class: "text-3xl font-semibold" },
	Te = { class: "my-3 leading-6" },
	Ue = { class: "flex items-center" },
	je = { class: "ml-1" },
	Ee = { key: 1, class: "mx-3" },
	qe = { class: "ml-1" },
	De = { key: 3, class: "mx-3" },
	Oe = { class: "flex items-center" },
	He = { key: 0 },
	Ae = { key: 1 },
	Pe = { key: 2 },
	Fe = { class: "flex mt-3 mb-4 w-fit" },
	We = ["innerHTML"],
	Ge = { class: "mt-10" },
	Ie = { class: "" },
	tt = {
		__name: "CourseDetail",
		props: { courseName: { type: String, required: !0 } },
		setup(a) {
			const i = a,
				e = $({
					url: "lms.lms.utils.get_course_details",
					cache: ["course", i.courseName],
					params: { course: i.courseName },
					auto: !0,
				}),
				_ = E(() => {
					var f, n;
					let o = [
						{ label: "All Courses", route: { name: "Courses" } },
					];
					return (
						o.push({
							label:
								(f = e == null ? void 0 : e.data) == null
									? void 0
									: f.title,
							route: {
								name: "CourseDetail",
								params: {
									course:
										(n = e == null ? void 0 : e.data) ==
										null
											? void 0
											: n.name,
								},
							},
						}),
						o
					);
				});
			return (o, f) =>
				t(e).data
					? (l(),
					  u("div", Ve, [
							s("header", Se, [
								m(
									t(K),
									{ class: "h-7", items: _.value },
									null,
									8,
									["items"]
								),
							]),
							s("div", Me, [
								s("div", Le, [
									s("div", ze, [
										s("div", Be, r(t(e).data.title), 1),
										s(
											"div",
											Te,
											r(t(e).data.short_introduction),
											1
										),
										s("div", Ue, [
											t(e).data.avg_rating
												? (l(),
												  y(
														t(U),
														{
															key: 0,
															text: o.__(
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
												? (l(), u("span", Ee, "·"))
												: v("", !0),
											t(e).data.enrollment_count
												? (l(),
												  y(
														t(U),
														{
															key: 2,
															text: o.__(
																"Enrolled Students"
															),
															class: "flex items-center",
														},
														{
															default: w(() => [
																m(t(D), {
																	class: "h-4 w-4 text-gray-700",
																}),
																s(
																	"span",
																	qe,
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
												? (l(), u("span", De, "·"))
												: v("", !0),
											s("div", Oe, [
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
														(l(!0),
														u(
															x,
															null,
															R(
																t(e).data
																	.instructors,
																(n) => (
																	l(),
																	y(
																		O,
																		{
																			user: n,
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
													? (l(),
													  u(
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
													? (l(),
													  u(
															"span",
															Ae,
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
													? (l(),
													  u(
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
										s("div", Fe, [
											(l(!0),
											u(
												x,
												null,
												R(
													t(e).data.tags,
													(n) => (
														l(),
														y(
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
																				n
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
											We
										),
										s("div", Ge, [
											m(
												ee,
												{
													courseName: t(e).data.name,
													showOutline: !0,
													showHeader: !0,
												},
												null,
												8,
												["courseName"]
											),
										]),
										t(e).data.avg_rating
											? (l(),
											  y(
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
export { tt as default };
//# sourceMappingURL=CourseDetail-MceVHLH3.js.map
