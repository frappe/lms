import {
	d as p,
	x as n,
	y as c,
	C as e,
	I as l,
	U as _,
	G as a,
	H as s,
	a8 as h,
	B as r,
	k as y,
	A as j,
	J as m,
	Q as g,
	R as x,
	a6 as k,
	a7 as v,
	X as $,
} from "./frappe-ui-20hnMCM8.js";
import { a as w } from "./index-Vx7mSx23.js";
import { P as J } from "./plus-pxSjkL_w.js";
/**
 * @license lucide-vue-next v0.309.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const M = w("MapPinIcon", [
		[
			"path",
			{
				d: "M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z",
				key: "2oe9fu",
			},
		],
		["circle", { cx: "12", cy: "10", r: "3", key: "ilqhr7" }],
	]),
	B = { class: "flex shadow rounded-md p-4 h-full" },
	C = ["src"],
	N = { class: "text-xl font-semibold mb-2" },
	D = { class: "font-medium" },
	P = { class: "flex items-center my-4" },
	V = { class: "font-medium" },
	Y = {
		__name: "JobCard",
		props: { job: { type: Object, default: null } },
		setup(t) {
			const i = p("$dayjs");
			return (o, d) => (
				n(),
				c("div", B, [
					e(
						"img",
						{
							src: t.job.company_logo,
							class: "w-12 h-12 rounded-lg object-contain mr-4",
						},
						null,
						8,
						C
					),
					e("div", null, [
						e("div", N, l(t.job.job_title), 1),
						e("div", null, [
							_(l(o.__("posted by")) + " ", 1),
							e("span", D, l(t.job.company_name), 1),
						]),
						e("div", P, [
							a(
								s(h),
								{
									label: t.job.type,
									theme: "green",
									size: "lg",
									class: "mr-4",
								},
								null,
								8,
								["label"]
							),
							a(
								s(h),
								{
									label: t.job.location,
									theme: "gray",
									size: "lg",
								},
								{
									prefix: r(() => [
										a(s(M), {
											class: "h-4 w-4 stroke-1.5",
										}),
									]),
									_: 1,
								},
								8,
								["label"]
							),
						]),
						e("div", null, [
							_(l(o.__("posted on")) + " ", 1),
							e(
								"span",
								V,
								l(s(i)(t.job.creation).format("DD MMM YYYY")),
								1
							),
						]),
					]),
				])
			);
		},
	},
	z = { class: "h-screen text-base" },
	I = {
		class: "sticky top-0 z-10 flex items-center justify-between border-b bg-white px-3 py-2.5 sm:px-5",
	},
	L = { class: "flex" },
	R = { key: 0 },
	q = { class: "grid grid-cols-2 gap-5 p-5" },
	H = {
		__name: "Jobs",
		setup(t) {
			const i = p("$user"),
				o = y({
					url: "lms.lms.api.get_job_opportunities",
					cache: ["jobs"],
					auto: !0,
				});
			return (d, A) => {
				var u;
				const f = $("router-link");
				return (
					n(),
					c("div", z, [
						e("header", I, [
							a(
								s(k),
								{
									class: "h-7",
									items: [
										{
											label: d.__("Jobs"),
											route: { name: "Jobs" },
										},
									],
								},
								null,
								8,
								["items"]
							),
							e("div", L, [
								(u = s(i).data) != null && u.name
									? (n(),
									  j(
											s(v),
											{ key: 0, variant: "solid" },
											{
												prefix: r(() => [
													a(s(J), {
														class: "h-4 w-4",
													}),
												]),
												default: r(() => [
													_(
														" " +
															l(d.__("New Job")),
														1
													),
												]),
												_: 1,
											}
									  ))
									: m("", !0),
							]),
						]),
						s(o).data
							? (n(),
							  c("div", R, [
									e("div", q, [
										s(o).data.length
											? (n(!0),
											  c(
													g,
													{ key: 0 },
													x(
														s(o).data,
														(b) => (
															n(),
															c("div", null, [
																a(
																	f,
																	{
																		to: {
																			name: "JobDetail",
																			params: {
																				job: b.name,
																			},
																		},
																	},
																	{
																		default:
																			r(
																				() => [
																					a(
																						Y,
																						{
																							job: b,
																						},
																						null,
																						8,
																						[
																							"job",
																						]
																					),
																				]
																			),
																		_: 2,
																	},
																	1032,
																	["to"]
																),
															])
														)
													),
													256
											  ))
											: m("", !0),
									]),
							  ]))
							: m("", !0),
					])
				);
			};
		},
	};
export { H as default };
//# sourceMappingURL=Jobs-PZPyKz-0.js.map
