import {
	x as r,
	A as s,
	av as t,
	G as l,
	as as u,
	I as n,
} from "./frappe-ui-iPT8hMkb.js";
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
//# sourceMappingURL=UserAvatar-nJqmkBPv.js.map
