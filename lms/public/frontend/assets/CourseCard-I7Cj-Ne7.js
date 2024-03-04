import { _ as b } from "./UserAvatar-3mSOKoKa.js";
import { s as w, B as _, U as B } from "./index-xt-hKVBz.js";
import {
	x as t,
	y as a,
	H as r,
	Q as h,
	R as f,
	F as g,
	G as n,
	a4 as v,
	L as s,
	K as c,
	a8 as x,
	M as o,
	I as y,
	U as k,
	J as l,
	T as d,
} from "./frappe-ui-n1bXVQkV.js";
import { S } from "./star-O1ih2gFp.js";
const C = {
		key: 0,
		class: "flex flex-col h-full rounded-md shadow-md text-base overflow-auto",
		style: { "min-height": "320px" },
	},
	U = { class: "flex relative top-4 left-4 w-fit" },
	z = { key: 0, class: "image-placeholder" },
	N = { class: "flex flex-col flex-auto p-4" },
	R = { class: "flex items-center justify-between mb-2" },
	V = { key: 0 },
	j = { key: 1 },
	I = { key: 2 },
	L = { key: 3 },
	M = { class: "text-xl font-semibold" },
	T = { class: "short-introduction" },
	A = { key: 0, class: "w-full bg-gray-200 rounded-full h-1 mb-2" },
	E = { key: 1, class: "text-sm mb-4" },
	F = { class: "flex items-center justify-between mt-auto" },
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
					  a("div", C, [
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
										a(
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
										? o("", !0)
										: (t(),
										  a("div", z, s(e.course.title[0]), 1)),
								],
								6
							),
							r("div", N, [
								r("div", R, [
									e.course.lesson_count
										? (t(),
										  a("div", V, [
												l(
													c(d),
													{
														text: u.__("Lessons"),
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
										: o("", !0),
									e.course.enrollment_count
										? (t(),
										  a("div", j, [
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
															l(c(B), {
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
										: o("", !0),
									e.course.avg_rating
										? (t(),
										  a("div", I, [
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
															l(c(S), {
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
										: o("", !0),
									e.course.status != "Approved"
										? (t(),
										  a("div", L, [
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
										: o("", !0),
								]),
								r("div", M, s(e.course.title), 1),
								r("div", T, s(e.course.short_introduction), 1),
								c(m) && e.course.membership
									? (t(),
									  a("div", A, [
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
									: o("", !0),
								c(m) && e.course.membership
									? (t(),
									  a(
											"div",
											E,
											s(
												Math.ceil(
													e.course.membership.progress
												)
											) + "% completed ",
											1
									  ))
									: o("", !0),
								r("div", F, [
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
												a(
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
											  a(
													"span",
													$,
													s(
														e.course.instructors[0]
															.full_name
													),
													1
											  ))
											: o("", !0),
										e.course.instructors.length == 2
											? (t(),
											  a(
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
											: o("", !0),
										e.course.instructors.length > 2
											? (t(),
											  a(
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
											: o("", !0),
									]),
									r("div", H, s(e.course.price), 1),
								]),
							]),
					  ]))
					: o("", !0);
		},
	};
export { W as _ };
//# sourceMappingURL=CourseCard-I7Cj-Ne7.js.map
