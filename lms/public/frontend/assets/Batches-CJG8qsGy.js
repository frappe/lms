import {
	d as C,
	x as n,
	y as u,
	F as g,
	G as h,
	a4 as f,
	L as t,
	K as o,
	a8 as x,
	M as y,
	H as a,
	J as i,
	k as Y,
	r as j,
	j as m,
	a6 as D,
	a7 as M,
	I as $,
	P as N,
	Q as V,
	R as L,
	a9 as P,
	W as z,
} from "./frappe-ui-n1bXVQkV.js";
import { B as O, f as B } from "./index-xt-hKVBz.js";
import { C as S, a as A } from "./clock-nM1CyeA6.js";
import { P as E } from "./plus-w56hNznP.js";
const F = {
		class: "flex flex-col border border-gray-200 rounded-md p-4 h-full",
		style: { "min-height": "150px" },
	},
	I = { class: "text-xl font-semibold mb-1" },
	R = { class: "short-introduction" },
	T = { class: "mt-auto" },
	U = { key: 0, class: "font-semibold text-lg mb-4" },
	G = { class: "flex items-center mb-3" },
	H = { class: "flex items-center mb-3" },
	J = { class: "flex items-center" },
	K = {
		__name: "BatchCard",
		props: { batch: { type: Object, default: null } },
		setup(s) {
			const d = C("$dayjs");
			return (c, v) => (
				n(),
				u("div", F, [
					s.batch.seat_count && s.batch.seats_left > 0
						? (n(),
						  g(
								o(x),
								{
									key: 0,
									theme: "green",
									class: "self-start mb-2",
								},
								{
									default: h(() => [
										f(
											t(s.batch.seats_left) +
												" " +
												t(c.__("Seat Left")),
											1
										),
									]),
									_: 1,
								}
						  ))
						: s.batch.seat_count && s.batch.seats_left <= 0
						? (n(),
						  g(
								o(x),
								{
									key: 1,
									theme: "red",
									class: "self-start mb-2",
								},
								{
									default: h(() => [
										f(t(c.__("Sold Out")), 1),
									]),
									_: 1,
								}
						  ))
						: y("", !0),
					a("div", I, t(s.batch.title), 1),
					a("div", R, t(s.batch.description), 1),
					a("div", T, [
						s.batch.amount
							? (n(), u("div", U, t(s.batch.price), 1))
							: y("", !0),
						a("div", G, [
							i(o(O), {
								class: "h-4 w-4 stroke-1.5 mr-2 text-gray-700",
							}),
							a(
								"span",
								null,
								t(s.batch.courses.length) +
									" " +
									t(c.__("Courses")),
								1
							),
						]),
						a("div", H, [
							i(o(S), {
								class: "h-4 w-4 stroke-1.5 mr-2 text-gray-700",
							}),
							a(
								"span",
								null,
								t(
									o(d)(s.batch.start_date).format(
										"DD MMM YYYY"
									)
								) +
									" - " +
									t(
										o(d)(s.batch.end_date).format(
											"DD MMM YYYY"
										)
									),
								1
							),
						]),
						a("div", J, [
							i(o(A), {
								class: "h-4 w-4 stroke-1.5 mr-2 text-gray-700",
							}),
							a(
								"span",
								null,
								t(o(B)(s.batch.start_time)) +
									" - " +
									t(o(B)(s.batch.end_time)),
								1
							),
						]),
					]),
				])
			);
		},
	},
	Q = { class: "h-screen text-base" },
	W = {
		class: "sticky top-0 z-10 flex items-center justify-between border-b bg-white px-3 py-2.5 sm:px-5",
	},
	q = { class: "flex" },
	X = { class: "pb-5" },
	Z = {
		key: 0,
		class: "grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-5 mt-5 mx-5",
	},
	ee = {
		key: 1,
		class: "grid flex-1 place-items-center text-xl font-medium text-gray-500",
	},
	te = { class: "flex flex-col items-center justify-center mt-4" },
	ce = {
		__name: "Batches",
		setup(s) {
			var p, k;
			const d = C("$user"),
				c = Y({
					url: "lms.lms.utils.get_batches",
					cache: [
						"batches",
						(p = d == null ? void 0 : d.data) == null
							? void 0
							: p.email,
					],
					auto: !0,
				}),
				v = j(0),
				_ = [
					{
						label: "Upcoming",
						batches: m(() => {
							var e;
							return (
								((e = c.data) == null ? void 0 : e.upcoming) ||
								[]
							);
						}),
						count: m(() => {
							var e, l;
							return (l =
								(e = c.data) == null ? void 0 : e.upcoming) ==
								null
								? void 0
								: l.length;
						}),
					},
				];
			return (
				(k = d.data) != null &&
					k.is_moderator &&
					(_.push({
						label: "Archived",
						batches: m(() => {
							var e;
							return (e = c.data) == null ? void 0 : e.archived;
						}),
						count: m(() => {
							var e, l;
							return (l =
								(e = c.data) == null ? void 0 : e.archived) ==
								null
								? void 0
								: l.length;
						}),
					}),
					_.push({
						label: "Private",
						batches: m(() => {
							var e;
							return (e = c.data) == null ? void 0 : e.private;
						}),
						count: m(() => {
							var e, l;
							return (l =
								(e = c.data) == null ? void 0 : e.private) ==
								null
								? void 0
								: l.length;
						}),
					})),
				d.data &&
					_.push({
						label: "Enrolled",
						batches: m(() => {
							var e;
							return (e = c.data) == null ? void 0 : e.enrolled;
						}),
						count: m(() => {
							var e, l;
							return (l =
								(e = c.data) == null ? void 0 : e.enrolled) ==
								null
								? void 0
								: l.length;
						}),
					}),
				(e, l) => {
					const w = z("router-link");
					return (
						n(),
						u("div", Q, [
							a("header", W, [
								i(
									o(D),
									{
										class: "h-7",
										items: [
											{
												label: e.__("All Batches"),
												route: { name: "Batches" },
											},
										],
									},
									null,
									8,
									["items"]
								),
								a("div", q, [
									i(
										o(M),
										{ variant: "solid" },
										{
											prefix: h(() => [
												i(o(E), { class: "h-4 w-4" }),
											]),
											default: h(() => [
												f(
													" " + t(e.__("New Batch")),
													1
												),
											]),
											_: 1,
										}
									),
								]),
							]),
							a("div", X, [
								i(
									o(P),
									{
										modelValue: v.value,
										"onUpdate:modelValue":
											l[0] ||
											(l[0] = (r) => (v.value = r)),
										tabs: _,
										tablistClass: "overflow-x-visible",
									},
									{
										tab: h(({ tab: r, selected: b }) => [
											a("div", null, [
												a(
													"button",
													{
														class: $([
															"group -mb-px flex items-center gap-2 border-b border-transparent py-2.5 text-base text-gray-600 duration-300 ease-in-out hover:border-gray-400 hover:text-gray-900",
															{
																"text-gray-900":
																	b,
															},
														]),
													},
													[
														r.icon
															? (n(),
															  g(N(r.icon), {
																	key: 0,
																	class: "h-5",
															  }))
															: y("", !0),
														f(
															" " +
																t(
																	e.__(
																		r.label
																	)
																) +
																" ",
															1
														),
														i(
															o(x),
															{
																class: $(
																	b
																		? "text-gray-800 border border-gray-800"
																		: "border border-gray-500"
																),
																variant:
																	"subtle",
																theme: "gray",
																size: "sm",
															},
															{
																default: h(
																	() => [
																		f(
																			t(
																				r.count
																			),
																			1
																		),
																	]
																),
																_: 2,
															},
															1032,
															["class"]
														),
													],
													2
												),
											]),
										]),
										default: h(({ tab: r }) => [
											r.batches && r.batches.value.length
												? (n(),
												  u("div", Z, [
														(n(!0),
														u(
															V,
															null,
															L(
																r.batches.value,
																(b) => (
																	n(),
																	g(
																		w,
																		{
																			to: {
																				name: "BatchDetail",
																				params: {
																					batchName:
																						b.name,
																				},
																			},
																		},
																		{
																			default:
																				h(
																					() => [
																						i(
																							K,
																							{
																								batch: b,
																							},
																							null,
																							8,
																							[
																								"batch",
																							]
																						),
																					]
																				),
																			_: 2,
																		},
																		1032,
																		["to"]
																	)
																)
															),
															256
														)),
												  ]))
												: (n(),
												  u("div", ee, [
														a("div", te, [
															a(
																"div",
																null,
																t(
																	e
																		.__(
																			"No {0} batches found"
																		)
																		.format(
																			r.label.toLowerCase()
																		)
																),
																1
															),
														]),
												  ])),
										]),
										_: 1,
									},
									8,
									["modelValue"]
								),
							]),
						])
					);
				}
			);
		},
	};
export { ce as default };
//# sourceMappingURL=Batches-CJG8qsGy.js.map
