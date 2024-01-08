import { _ as f } from "./UserAvatar.b64a03ac.js";
import { s as g, B as v, U as y } from "./index.43e529db.js";
import {
	s,
	u as r,
	A as o,
	K as i,
	L as d,
	E as t,
	F as c,
	B as m,
	a2 as h,
	C as n,
	D as a,
	z as x,
	X as b,
	a0 as k,
	y as w,
} from "./frappe-ui.f2211ca2.js";
import { S as _ } from "./star.d3e8ecca.js";
const C = {
		key: 0,
		class: "flex flex-col border border-gray-200 h-full rounded-md shadow-sm text-base overflow-auto",
		style: { "min-height": "320px" },
	},
	B = { class: "flex relative top-4 left-4 w-fit" },
	S = { class: "course-card-pills rounded-md border border-gray-200" },
	z = { key: 0, class: "image-placeholder" },
	N = { class: "flex flex-col flex-auto p-4" },
	U = { class: "flex items-center justify-between mb-2" },
	V = { key: 0, class: "flex items-center space-x-1 py-1" },
	j = { key: 1, class: "flex items-center space-x-1 py-1" },
	A = { key: 2, class: "flex items-center space-x-1 py-1" },
	D = { key: 3 },
	E = { class: "text-xl font-semibold" },
	F = { class: "short-introduction" },
	I = { key: 0, class: "w-full bg-gray-200 rounded-full h-1 mb-2" },
	L = { key: 1, class: "text-sm mb-4" },
	M = { class: "flex items-center justify-between mt-auto" },
	O = { class: "flex avatar-group overlap" },
	R = { key: 0 },
	$ = { key: 1 },
	K = { key: 2 },
	T = { class: "font-semibold" },
	Q = {
		__name: "CourseCard",
		props: { course: { type: Object, default: null } },
		setup(e) {
			const { user: u } = g();
			return (X, q) =>
				e.course.title
					? (s(),
					  r("div", C, [
							o(
								"div",
								{
									class: m([
										"course-image",
										{ "default-image": !e.course.image },
									]),
									style: h({
										backgroundImage:
											"url(" +
											encodeURI(e.course.image) +
											")",
									}),
								},
								[
									o("div", B, [
										(s(!0),
										r(
											i,
											null,
											d(
												e.course.tags,
												(l) => (
													s(), r("div", S, t(l), 1)
												)
											),
											256
										)),
									]),
									e.course.image
										? c("", !0)
										: (s(),
										  r("div", z, t(e.course.title[0]), 1)),
								],
								6
							),
							o("div", N, [
								o("div", U, [
									e.course.lesson_count
										? (s(),
										  r("div", V, [
												n(a(v), {
													class: "h-4 w-4 stroke-1.5 text-gray-700",
												}),
												o(
													"span",
													null,
													t(e.course.lesson_count),
													1
												),
										  ]))
										: c("", !0),
									e.course.enrollment_count
										? (s(),
										  r("div", j, [
												n(a(y), {
													class: "h-4 w-4 stroke-1.5 text-gray-700",
												}),
												o(
													"span",
													null,
													t(
														e.course
															.enrollment_count
													),
													1
												),
										  ]))
										: c("", !0),
									e.course.avg_rating
										? (s(),
										  r("div", A, [
												n(a(_), {
													class: "h-4 w-4 stroke-1.5 text-gray-700",
												}),
												o(
													"span",
													null,
													t(e.course.avg_rating),
													1
												),
										  ]))
										: c("", !0),
									e.course.status != "Approved"
										? (s(),
										  r("div", D, [
												n(
													a(k),
													{
														variant: "solid",
														theme:
															e.course.status ===
															"Under Review"
																? "orange"
																: "blue",
														size: "sm",
													},
													{
														default: x(() => [
															b(
																t(
																	e.course
																		.status
																),
																1
															),
														]),
														_: 1,
													},
													8,
													["theme"]
												),
										  ]))
										: c("", !0),
								]),
								o("div", E, t(e.course.title), 1),
								o("div", F, t(e.course.short_introduction), 1),
								a(u) && e.course.membership
									? (s(),
									  r("div", I, [
											o(
												"div",
												{
													class: "bg-gray-900 h-1 rounded-full",
													style: h({
														width:
															Math.ceil(
																e.course
																	.membership
																	.progress
															) + "%",
													}),
												},
												null,
												4
											),
									  ]))
									: c("", !0),
								a(u) && e.course.membership
									? (s(),
									  r(
											"div",
											L,
											t(
												Math.ceil(
													e.course.membership.progress
												)
											) + "% completed ",
											1
									  ))
									: c("", !0),
								o("div", M, [
									o("div", O, [
										o(
											"div",
											{
												class: m([
													"mr-1",
													{
														"avatar-group overlap":
															e.course.instructors
																.length > 1,
													},
												]),
											},
											[
												(s(!0),
												r(
													i,
													null,
													d(
														e.course.instructors,
														(l) => (
															s(),
															w(
																f,
																{ user: l },
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
										e.course.instructors.length == 1
											? (s(),
											  r(
													"span",
													R,
													t(
														e.course.instructors[0]
															.full_name
													),
													1
											  ))
											: c("", !0),
										e.course.instructors.length == 2
											? (s(),
											  r(
													"span",
													$,
													t(
														e.course.instructors[0]
															.first_name
													) +
														" and " +
														t(
															e.course
																.instructors[1]
																.first_name
														),
													1
											  ))
											: c("", !0),
										e.course.instructors.length > 2
											? (s(),
											  r(
													"span",
													K,
													t(
														e.course.instructors[0]
															.first_name
													) +
														" and " +
														t(
															e.course.instructors
																.length - 1
														) +
														" others ",
													1
											  ))
											: c("", !0),
									]),
									o("div", T, t(e.course.price), 1),
								]),
							]),
					  ]))
					: c("", !0);
		},
	};
export { Q as _ };
