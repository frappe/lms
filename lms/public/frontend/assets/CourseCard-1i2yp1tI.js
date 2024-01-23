import { _ as f } from "./UserAvatar-nJqmkBPv.js";
import { s as g, B as v, U as y } from "./index-qZ7Yta4u.js";
import {
	x as s,
	y as r,
	J as o,
	Q as u,
	R as d,
	H as t,
	I as c,
	C as m,
	V as h,
	F as n,
	G as a,
	B as x,
	U as b,
	a8 as k,
	A as w,
} from "./frappe-ui-iPT8hMkb.js";
import { S as B } from "./star-xishKgdq.js";
const C = {
		key: 0,
		class: "flex flex-col border border-gray-200 h-full rounded-md shadow-sm text-base overflow-auto",
		style: { "min-height": "320px" },
	},
	S = { class: "flex relative top-4 left-4 w-fit" },
	U = { class: "course-card-pills rounded-md border border-gray-200" },
	V = { key: 0, class: "image-placeholder" },
	N = { class: "flex flex-col flex-auto p-4" },
	j = { class: "flex items-center justify-between mb-2" },
	z = { key: 0, class: "flex items-center space-x-1 py-1" },
	I = { key: 1, class: "flex items-center space-x-1 py-1" },
	R = { key: 2, class: "flex items-center space-x-1 py-1" },
	A = { key: 3 },
	F = { class: "text-xl font-semibold" },
	M = { class: "short-introduction" },
	O = { key: 0, class: "w-full bg-gray-200 rounded-full h-1 mb-2" },
	_ = { key: 1, class: "text-sm mb-4" },
	$ = { class: "flex items-center justify-between mt-auto" },
	D = { class: "flex avatar-group overlap" },
	E = { key: 0 },
	G = { key: 1 },
	H = { key: 2 },
	J = { class: "font-semibold" },
	W = {
		__name: "CourseCard",
		props: { course: { type: Object, default: null } },
		setup(e) {
			const { user: i } = g();
			return (L, Q) =>
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
									o("div", S, [
										(s(!0),
										r(
											u,
											null,
											d(
												e.course.tags,
												(l) => (
													s(), r("div", U, t(l), 1)
												)
											),
											256
										)),
									]),
									e.course.image
										? c("", !0)
										: (s(),
										  r("div", V, t(e.course.title[0]), 1)),
								],
								6
							),
							o("div", N, [
								o("div", j, [
									e.course.lesson_count
										? (s(),
										  r("div", z, [
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
										  r("div", I, [
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
										  r("div", R, [
												n(a(B), {
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
										  r("div", A, [
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
								o("div", F, t(e.course.title), 1),
								o("div", M, t(e.course.short_introduction), 1),
								a(i) && e.course.membership
									? (s(),
									  r("div", O, [
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
								a(i) && e.course.membership
									? (s(),
									  r(
											"div",
											_,
											t(
												Math.ceil(
													e.course.membership.progress
												)
											) + "% completed ",
											1
									  ))
									: c("", !0),
								o("div", $, [
									o("div", D, [
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
													u,
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
													E,
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
													G,
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
													H,
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
									o("div", J, t(e.course.price), 1),
								]),
							]),
					  ]))
					: c("", !0);
		},
	};
export { W as _ };
//# sourceMappingURL=CourseCard-1i2yp1tI.js.map
