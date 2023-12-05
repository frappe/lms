var N = Object.defineProperty,
	S = Object.defineProperties;
var j = Object.getOwnPropertyDescriptors;
var h = Object.getOwnPropertySymbols;
var b = Object.prototype.hasOwnProperty,
	w = Object.prototype.propertyIsEnumerable;
var p = (e, s, t) =>
		s in e
			? N(e, s, {
					enumerable: !0,
					configurable: !0,
					writable: !0,
					value: t,
			  })
			: (e[s] = t),
	m = (e, s) => {
		for (var t in s || (s = {})) b.call(s, t) && p(e, t, s[t]);
		if (h) for (var t of h(s)) w.call(s, t) && p(e, t, s[t]);
		return e;
	},
	g = (e, s) => S(e, j(s));
var C = (e, s) => {
	var t = {};
	for (var a in e) b.call(e, a) && s.indexOf(a) < 0 && (t[a] = e[a]);
	if (e != null && h)
		for (var a of h(e)) s.indexOf(a) < 0 && w.call(e, a) && (t[a] = e[a]);
	return t;
};
import {
	l as $,
	o,
	d as c,
	k as r,
	F as v,
	m as y,
	t as l,
	n as B,
	p as z,
	q as A,
	e as n,
	u,
	v as O,
	x as q,
	y as U,
	z as V,
} from "./frappe-ui.8966d601.js";
var _ = {
	xmlns: "http://www.w3.org/2000/svg",
	width: 24,
	height: 24,
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	"stroke-width": 2,
	"stroke-linecap": "round",
	"stroke-linejoin": "round",
};
const F = (e) => e.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase(),
	f =
		(e, s) =>
		(oe, { attrs: d, slots: x }) => {
			var k = oe,
				{
					size: t,
					strokeWidth: a = 2,
					absoluteStrokeWidth: i,
					color: M,
				} = k,
				I = C(k, [
					"size",
					"strokeWidth",
					"absoluteStrokeWidth",
					"color",
				]);
			return $(
				"svg",
				m(
					g(
						m(
							g(m({}, _), {
								width: t || _.width,
								height: t || _.height,
								stroke: M || _.stroke,
								"stroke-width": i
									? (Number(a) * 24) / Number(t)
									: a,
							}),
							d
						),
						{
							class: [
								"lucide",
								`lucide-${F(e)}`,
								(d == null ? void 0 : d.class) || "",
							],
						}
					),
					I
				),
				[...s.map((L) => $(...L)), ...(x.default ? [x.default()] : [])]
			);
		},
	H = f("BookOpenIcon", [
		[
			"path",
			{ d: "M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z", key: "vv98re" },
		],
		[
			"path",
			{ d: "M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z", key: "1cyq3y" },
		],
	]),
	D = f("StarIcon", [
		[
			"polygon",
			{
				points: "12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2",
				key: "8f66p6",
			},
		],
	]),
	E = f("UsersIcon", [
		[
			"path",
			{ d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", key: "1yyitq" },
		],
		["circle", { cx: "9", cy: "7", r: "4", key: "nufk8" }],
		["path", { d: "M22 21v-2a4 4 0 0 0-3-3.87", key: "kshegd" }],
		["path", { d: "M16 3.13a4 4 0 0 1 0 7.75", key: "1da9ce" }],
	]);
const K = {
		class: "flex flex-col h-full border border-gray-200 rounded-md shadow-sm mt-5",
	},
	P = { class: "flex relative top-4 left-4" },
	R = { class: "course-card-pills rounded-md border border-gray-200" },
	Z = { key: 0, class: "flex flex-1 text-4xl font-bold" },
	G = { class: "p-4" },
	J = { class: "flex text-base items-center justify-between" },
	Q = { class: "flex items-center space-x-1 py-1" },
	T = { class: "flex items-center space-x-1 py-1" },
	X = { class: "flex items-center space-x-1 py-1" },
	Y = { class: "text-2xl font-semibold" },
	W = { class: "text-ellipsis truncate text-base" },
	ee = {
		__name: "CourseCard",
		props: { course: { type: Object, default: null } },
		setup(e) {
			return (s, t) => (
				o(),
				c("div", K, [
					r(
						"div",
						{
							class: z([
								"course-image",
								{ "default-image": !e.course.image },
							]),
							style: A({
								backgroundImage: "url(" + e.course.image + ")",
							}),
						},
						[
							r("div", P, [
								(o(!0),
								c(
									v,
									null,
									y(
										e.course.tags,
										(a) => (o(), c("div", R, l(a), 1))
									),
									256
								)),
							]),
							e.course.image
								? B("", !0)
								: (o(), c("div", Z, l(e.course.title[0]), 1)),
						],
						6
					),
					r("div", G, [
						r("div", J, [
							r("div", Q, [
								n(u(H), { class: "h-4 w-4 text-gray-700" }),
								r("span", null, l(e.course.lesson_count), 1),
							]),
							r("div", T, [
								n(u(E), { class: "h-4 w-4 text-gray-700" }),
								r(
									"span",
									null,
									l(e.course.enrollment_count),
									1
								),
							]),
							r("div", X, [
								n(u(D), { class: "h-4 w-4 text-gray-700" }),
								r("span", null, l(e.course.avg_rating), 1),
							]),
						]),
						r("div", Y, l(e.course.title), 1),
						r("div", W, l(e.course.short_introduction), 1),
						(o(!0),
						c(
							v,
							null,
							y(e.course.instructors, (a) => (o(), c("div"))),
							256
						)),
					]),
				])
			);
		},
	},
	se = {
		__name: "UserAvatar",
		props: { user: { type: Object, default: null } },
		setup(e) {
			return (s, t) =>
				e.user
					? (o(),
					  O(
							u(U),
							q(
								{
									key: 0,
									class: "",
									label: e.user.full_name,
									image: e.user.user_image,
								},
								s.$attrs
							),
							null,
							16,
							["label", "image"]
					  ))
					: B("", !0);
		},
	},
	te = { class: "container" },
	ae = r("div", { class: "text-2xl font-semibold" }, " All Courses ", -1),
	re = { class: "grid grid-cols-3 gap-8" },
	ne = {
		__name: "Courses",
		setup(e) {
			const s = V({
				type: "list",
				doctype: "LMS Course",
				url: "lms.lms.utils.get_courses",
				auto: !0,
			});
			return (t, a) => (
				o(),
				c("div", te, [
					ae,
					r("div", re, [
						(o(!0),
						c(
							v,
							null,
							y(
								u(s).data,
								(i) => (
									o(),
									c("div", null, [
										n(ee, { course: i }, null, 8, [
											"course",
										]),
										n(
											se,
											{ user: i.instructors[0] },
											null,
											8,
											["user"]
										),
									])
								)
							),
							256
						)),
					]),
				])
			);
		},
	};
export { ne as default };
