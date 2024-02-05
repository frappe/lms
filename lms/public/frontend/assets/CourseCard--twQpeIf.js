import { _ as b } from "./UserAvatar-yrWInUTi.js";
import { s as w, B, U as _ } from "./index-Vx7mSx23.js";
import {
	x as t,
	y as o,
	C as r,
	Q as h,
	R as f,
	A as g,
	B as n,
	U as v,
	I as s,
	H as c,
	a8 as x,
	J as a,
	F as y,
	V as k,
	G as l,
	T as d,
} from "./frappe-ui-20hnMCM8.js";
import { S as C } from "./star-ypmGZNF0.js";
const S = {
		key: 0,
		class: "flex flex-col h-full rounded-md shadow-md text-base overflow-auto",
		style: { "min-height": "320px" },
	},
	U = { class: "flex relative top-4 left-4 w-fit" },
	V = { key: 0, class: "image-placeholder" },
	z = { class: "flex flex-col flex-auto p-4" },
	N = { class: "flex items-center justify-between mb-2" },
	R = { key: 0 },
	j = { key: 1 },
	A = { key: 2 },
	I = { key: 3 },
	T = { class: "text-xl font-semibold" },
	E = { class: "short-introduction" },
	F = { key: 0, class: "w-full bg-gray-200 rounded-full h-1 mb-2" },
	L = { key: 1, class: "text-sm mb-4" },
	M = { class: "flex items-center justify-between mt-auto" },
	O = { class: "flex avatar-group overlap" },
	$ = { key: 0 },
	D = { key: 1 },
	G = { key: 2 },
	H = { class: "font-semibold" },
	W = {
		__name: "CourseCard",
		props: { course: { type: Object, default: null } },
		setup(e) {
			const { user: m } = w();
			return (u, J) =>
				e.course.title
					? (t(),
					  o("div", S, [
							r(
								"div",
								{
									class: y([
										"course-image",
										{ "default-image": !e.course.image },
									]),
									style: k({
										backgroundImage:
											"url(" +
											encodeURI(e.course.image) +
											")",
									}),
								},
								[
									r("div", U, [
										(t(!0),
										o(
											h,
											null,
											f(
												e.course.tags,
												(i) => (
													t(),
													g(
														c(x),
														{
															theme: "gray",
															size: "lg",
															class: "mr-2",
														},
														{
															default: n(() => [
																v(s(i), 1),
															]),
															_: 2,
														},
														1024
													)
												)
											),
											256
										)),
									]),
									e.course.image
										? a("", !0)
										: (t(),
										  o("div", V, s(e.course.title[0]), 1)),
								],
								6
							),
							r("div", z, [
								r("div", N, [
									e.course.lesson_count
										? (t(),
										  o("div", R, [
												l(
													c(d),
													{
														text: u.__("Lessons"),
														class: "flex items-center space-x-1 py-1",
													},
													{
														default: n(() => [
															l(c(B), {
																class: "h-4 w-4 stroke-1.5 text-gray-700",
															}),
															r(
																"span",
																null,
																s(
																	e.course
																		.lesson_count
																),
																1
															),
														]),
														_: 1,
													},
													8,
													["text"]
												),
										  ]))
										: a("", !0),
									e.course.enrollment_count
										? (t(),
										  o("div", j, [
												l(
													c(d),
													{
														text: u.__(
															"Enrolled Students"
														),
														class: "flex items-center space-x-1 py-1",
													},
													{
														default: n(() => [
															l(c(_), {
																class: "h-4 w-4 stroke-1.5 text-gray-700",
															}),
															r(
																"span",
																null,
																s(
																	e.course
																		.enrollment_count
																),
																1
															),
														]),
														_: 1,
													},
													8,
													["text"]
												),
										  ]))
										: a("", !0),
									e.course.avg_rating
										? (t(),
										  o("div", A, [
												l(
													c(d),
													{
														text: u.__(
															"Average Rating"
														),
														class: "flex items-center space-x-1 py-1",
													},
													{
														default: n(() => [
															l(c(C), {
																class: "h-4 w-4 stroke-1.5 text-gray-700",
															}),
															r(
																"span",
																null,
																s(
																	e.course
																		.avg_rating
																),
																1
															),
														]),
														_: 1,
													},
													8,
													["text"]
												),
										  ]))
										: a("", !0),
									e.course.status != "Approved"
										? (t(),
										  o("div", I, [
												l(
													c(x),
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
														default: n(() => [
															v(
																s(
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
										: a("", !0),
								]),
								r("div", T, s(e.course.title), 1),
								r("div", E, s(e.course.short_introduction), 1),
								c(m) && e.course.membership
									? (t(),
									  o("div", F, [
											r(
												"div",
												{
													class: "bg-gray-900 h-1 rounded-full",
													style: k({
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
									: a("", !0),
								c(m) && e.course.membership
									? (t(),
									  o(
											"div",
											L,
											s(
												Math.ceil(
													e.course.membership.progress
												)
											) + "% completed ",
											1
									  ))
									: a("", !0),
								r("div", M, [
									r("div", O, [
										r(
											"div",
											{
												class: y([
													"mr-1",
													{
														"avatar-group overlap":
															e.course.instructors
																.length > 1,
													},
												]),
											},
											[
												(t(!0),
												o(
													h,
													null,
													f(
														e.course.instructors,
														(i) => (
															t(),
															g(
																b,
																{ user: i },
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
											? (t(),
											  o(
													"span",
													$,
													s(
														e.course.instructors[0]
															.full_name
													),
													1
											  ))
											: a("", !0),
										e.course.instructors.length == 2
											? (t(),
											  o(
													"span",
													D,
													s(
														e.course.instructors[0]
															.first_name
													) +
														" and " +
														s(
															e.course
																.instructors[1]
																.first_name
														),
													1
											  ))
											: a("", !0),
										e.course.instructors.length > 2
											? (t(),
											  o(
													"span",
													G,
													s(
														e.course.instructors[0]
															.first_name
													) +
														" and " +
														s(
															e.course.instructors
																.length - 1
														) +
														" others ",
													1
											  ))
											: a("", !0),
									]),
									r("div", H, s(e.course.price), 1),
								]),
							]),
					  ]))
					: a("", !0);
		},
	};
export { W as _ };
//# sourceMappingURL=CourseCard--twQpeIf.js.map
