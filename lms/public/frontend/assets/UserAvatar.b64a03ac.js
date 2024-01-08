import {
	s as r,
	y as s,
	a3 as t,
	D as l,
	a4 as u,
	F as n,
} from "./frappe-ui.f2211ca2.js";
const i = {
	__name: "UserAvatar",
	props: { user: { type: Object, default: null }, size: { type: String } },
	setup(e) {
		return (a, m) =>
			e.user
				? (r(),
				  s(
						l(u),
						t(
							{
								key: 0,
								class: "avatar border border-gray-300",
								label: e.user.full_name,
								image: e.user.user_image,
								size: e.size,
							},
							a.$attrs
						),
						null,
						16,
						["label", "image", "size"]
				  ))
				: n("", !0);
	},
};
export { i as _ };
