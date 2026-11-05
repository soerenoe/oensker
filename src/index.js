export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);
		const path = url.pathname;
		const method = request.method;

		// Helper: JSON response
		const json = (data, status = 200) =>
			new Response(JSON.stringify(data), {
				status,
				headers: { "Content-Type": "application/json" },
			});

		try {
			// Block the root URL to hide the app
			if (path === "/" || path === "/index.html") {
				return new Response("Not Found", { status: 404 });
			}

			// Block the creator page if there is no invite code in the URL
			if (path === "/newlist-p2q8.html" && !url.searchParams.has("invite")) {
				return new Response("Not Found", { status: 404 });
			}

			// POST /admin/creators — generate a new invite code
			if (path === "/admin/creators" && method === "POST") {
				const body = await request.json();
				const auth = url.searchParams.get("auth");
				if (auth !== env.ADMIN_PASSWORD) return json({ error: "Unauthorized" }, 401);

				const creator_id = crypto.randomUUID();
				const invite_code = crypto.randomUUID().split("-")[0]; // Short, easy to type code

				await env.oensker_db
					.prepare("INSERT INTO creators (creator_id, name, invite_code) VALUES (?, ?, ?)")
					.bind(creator_id, body.name, invite_code)
					.run();

				return json({ success: true, invite_code });
			}

			// GET /admin/creators — list all creators
			if (path === "/admin/creators" && method === "GET") {
				const auth = url.searchParams.get("auth");
				if (auth !== env.ADMIN_PASSWORD) return json({ error: "Unauthorized" }, 401);

				const creators = await env.oensker_db.prepare("SELECT * FROM creators ORDER BY created_at DESC").all();
				return json({ creators: creators.results });
			}

			// DELETE /admin/creators/:id — revoke a creator's access
			if (path.match(/^\/admin\/creators\/[^/]+$/) && method === "DELETE") {
				const creator_id = path.split("/")[3];
				const auth = url.searchParams.get("auth");
				if (auth !== env.ADMIN_PASSWORD) return json({ error: "Unauthorized" }, 401);

				await env.oensker_db.prepare("DELETE FROM creators WHERE creator_id = ?").bind(creator_id).run();
				return json({ success: true });
			}

			// POST /lists — create a new list
			if (path === "/lists" && method === "POST") {
				const body = await request.json();

				// 1. Verify the invite code
				if (!body.invite_code) {
					return json({ error: "Adgangskode mangler" }, 401);
				}

				const creator = await env.oensker_db
					.prepare("SELECT creator_id, name FROM creators WHERE invite_code = ?")
					.bind(body.invite_code)
					.first();

				if (!creator) {
					return json({ error: "Ugyldig adgangskode" }, 401);
				}

				const oneYearFromNow = new Date();
				oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
				if (new Date(body.event_date) > oneYearFromNow) {
					return json({ error: "Event date must be within 1 year from now" }, 400);
				}

				const list_id = crypto.randomUUID();
				const creator_token = crypto.randomUUID();
				const created_at = new Date().toISOString();

				// 2. Save the list with the creator's info
				await env.oensker_db
					.prepare(
						"INSERT INTO lists (list_id, creator_token, title, event_name, event_date, created_at, creator_name, creator_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
					)
					.bind(
						list_id, 
						creator_token, 
						body.title, 
						body.event_name || null, 
						body.event_date, 
						created_at, 
						creator.name, 
						creator.creator_id
					)
					.run();

				return json({ list_id, creator_token });
			}

			// POST /upload — upload an image to R2
			if (path === "/upload" && method === "POST") {
				const formData = await request.formData();
				const file = formData.get("image");
				const creatorToken = formData.get("creator_token");

				if (!file || !creatorToken) {
					return json({ error: "Missing image or token" }, 400);
				}

				// Verify the token belongs to a real list
				const list = await env.oensker_db
					.prepare("SELECT list_id FROM lists WHERE creator_token = ?")
					.bind(creatorToken)
					.first();

				if (!list) {
					return json({ error: "Unauthorized" }, 403);
				}

				const key = crypto.randomUUID() + '-' + file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
				await env.oensker_images.put(key, file.stream(), {
					httpMetadata: { contentType: file.type }
				});

				return json({ url: `/images/${key}` });
			}

			// GET /images/:key — serve an image from R2
			if (path.startsWith("/images/") && method === "GET") {
				const key = path.replace("/images/", "");
				const object = await env.oensker_images.get(key);
				
				if (!object) return new Response("Not found", { status: 404 });
				
				return new Response(object.body, {
					headers: { "Content-Type": object.httpMetadata?.contentType || "application/octet-stream" }
				});
			}

			// PATCH /lists/:id — edit list title/date (creator only)
			if (path.match(/^\/lists\/[^/]+$/) && method === "PATCH") {
				const list_id = path.split("/")[2];
				const body = await request.json();

				const list = await env.oensker_db
					.prepare("SELECT creator_token FROM lists WHERE list_id = ?")
					.bind(list_id)
					.first();

				if (!list) return json({ error: "List not found" }, 404);
				if (list.creator_token !== body.creator_token)
					return json({ error: "Unauthorized" }, 403);

				await env.oensker_db
					.prepare("UPDATE lists SET title = ?, event_name = ?, event_date = ? WHERE list_id = ?")
					.bind(body.title, body.event_name || null, body.event_date, list_id)
					.run();

				return json({ success: true });
			}

			// GET /lists/:id/creator — creator's view (items, no reservation data)
			if (path.match(/^\/lists\/[^/]+\/creator$/) && method === "GET") {
				const list_id = path.split("/")[2];
				const creator_token = url.searchParams.get("creator_token");

				const list = await env.oensker_db
					.prepare("SELECT * FROM lists WHERE list_id = ?")
					.bind(list_id)
					.first();

				if (!list) return json({ error: "List not found" }, 404);
				if (list.creator_token !== creator_token)
					return json({ error: "Unauthorized" }, 403);

				const items = await env.oensker_db
					.prepare("SELECT * FROM items WHERE list_id = ?")
					.bind(list_id)
					.all();

				return json({
					title: list.title,
					event_date: list.event_date,
					items: items.results,
				});
			}

			// GET /lists/:id/guest — guest's view (items + reservation status)
			if (path.match(/^\/lists\/[^/]+\/guest$/) && method === "GET") {
				const list_id = path.split("/")[2];

				const list = await env.oensker_db
					.prepare("SELECT title, event_date, creator_name FROM lists WHERE list_id = ?")
					.bind(list_id)
					.first();

				if (!list) return json({ error: "List not found" }, 404);

				// --- NEW: Log the view ---
				const ip = request.headers.get("cf-connecting-ip") || "unknown";
				const view_id = crypto.randomUUID();
				await env.oensker_db
					.prepare("INSERT INTO list_views (view_id, list_id, ip_address) VALUES (?, ?, ?)")
					.bind(view_id, list_id, ip)
					.run();
				// --------------------------

				const items = await env.oensker_db
					.prepare(
						`SELECT items.*, reservations.guest_token, reservations.guest_name
						 FROM items
						 LEFT JOIN reservations ON reservations.item_id = items.item_id
						 WHERE items.list_id = ?`
					)
					.bind(list_id)
					.all();

				return json({
					title: list.title,
					event_date: list.event_date,
					creator_name: list.creator_name,
					items: items.results,
				});
			}

			// POST /lists/:id/items — add item (creator only)
			if (path.match(/^\/lists\/[^/]+\/items$/) && method === "POST") {
				const list_id = path.split("/")[2];
				const body = await request.json();

				const list = await env.oensker_db
					.prepare("SELECT creator_token FROM lists WHERE list_id = ?")
					.bind(list_id)
					.first();

				if (!list) return json({ error: "List not found" }, 404);
				if (list.creator_token !== body.creator_token)
					return json({ error: "Unauthorized" }, 403);

				const item_id = crypto.randomUUID();
				const created_at = new Date().toISOString();

				await env.oensker_db
					.prepare(
						`INSERT INTO items (item_id, list_id, name, photo_url, price, category, remark, link, created_at)
						 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
					)
					.bind(
						item_id,
						list_id,
						body.name,
						body.photo_url || null,
						body.price || null,
						body.category || null,
						body.remark || null,
						body.link || null,
						created_at
					)
					.run();

				return json({ item_id });
			}

			// DELETE /items/:id — delete item (creator only)
			if (path.match(/^\/items\/[^/]+$/) && method === "DELETE") {
				const item_id = path.split("/")[2];
				const body = await request.json();

				const item = await env.oensker_db
					.prepare(
						`SELECT lists.creator_token FROM items
						 JOIN lists ON lists.list_id = items.list_id
						 WHERE items.item_id = ?`
					)
					.bind(item_id)
					.first();

				if (!item) return json({ error: "Item not found" }, 404);
				if (item.creator_token !== body.creator_token)
					return json({ error: "Unauthorized" }, 403);

				await env.oensker_db
					.prepare("DELETE FROM reservations WHERE item_id = ?")
					.bind(item_id)
					.run();
				await env.oensker_db
					.prepare("DELETE FROM items WHERE item_id = ?")
					.bind(item_id)
					.run();

				return json({ success: true });
			}

			// POST /items/:id/reserve — guest reserves an item
			if (path.match(/^\/items\/[^/]+\/reserve$/) && method === "POST") {
				const item_id = path.split("/")[2];
				const body = await request.json();

				const existing = await env.oensker_db
					.prepare("SELECT * FROM reservations WHERE item_id = ?")
					.bind(item_id)
					.first();

				if (existing) return json({ error: "Already reserved" }, 409);

				const reservation_id = crypto.randomUUID();
				const reserved_at = new Date().toISOString();

				await env.oensker_db
					.prepare(
						"INSERT INTO reservations (reservation_id, item_id, guest_token, guest_name, reserved_at) VALUES (?, ?, ?, ?, ?)"
					)
					.bind(reservation_id, item_id, body.guest_token, body.guest_name || null, reserved_at)
					.run();

				return json({ success: true });
			}

			// DELETE /items/:id/reserve — guest cancels their own reservation
			if (path.match(/^\/items\/[^/]+\/reserve$/) && method === "DELETE") {
				const item_id = path.split("/")[2];
				const body = await request.json();

				const reservation = await env.oensker_db
					.prepare("SELECT * FROM reservations WHERE item_id = ?")
					.bind(item_id)
					.first();

				if (!reservation) return json({ error: "No reservation found" }, 404);
				if (reservation.guest_token !== body.guest_token)
					return json({ error: "Unauthorized" }, 403);

				await env.oensker_db
					.prepare("DELETE FROM reservations WHERE item_id = ?")
					.bind(item_id)
					.run();

				return json({ success: true });
			}

			// PATCH /items/:id — edit item (creator only)
			if (path.match(/^\/items\/[^/]+$/) && method === "PATCH") {
				const item_id = path.split("/")[2];
				const body = await request.json();

				const item = await env.oensker_db
					.prepare(
						`SELECT lists.creator_token FROM items
						 JOIN lists ON lists.list_id = items.list_id
						 WHERE items.item_id = ?`
					)
					.bind(item_id)
					.first();

				if (!item) return json({ error: "Item not found" }, 404);
				if (item.creator_token !== body.creator_token)
					return json({ error: "Unauthorized" }, 403);

				await env.oensker_db
					.prepare(
						`UPDATE items SET name = ?, price = ?, category = ?, remark = ?, link = ?, photo_url = ?
						 WHERE item_id = ?`
					)
					.bind(
						body.name,
						body.price || null,
						body.category || null,
						body.remark || null,
						body.link || null,
						body.photo_url || null,
						item_id
					)
					.run();

				return json({ success: true });
			}

			// DELETE /lists/:id — creator manually deletes their list
			if (path.match(/^\/lists\/[^/]+$/) && method === "DELETE") {
				const list_id = path.split("/")[2];
				let body = {};
				try { body = await request.json(); } catch(e) {}
				
				const token = body.creator_token || url.searchParams.get("creator_token");
				const auth = url.searchParams.get("auth");

				const list = await env.oensker_db
					.prepare("SELECT creator_token FROM lists WHERE list_id = ?")
					.bind(list_id)
					.first();

				if (!list) return json({ error: "List not found" }, 404);
				
				// Allow if creator token matches OR if admin password is valid
				const isAdmin = auth === env.ADMIN_PASSWORD;
				if (list.creator_token !== token && !isAdmin) {
					return json({ error: "Unauthorized" }, 403);
				}

				await env.oensker_db
					.prepare(`DELETE FROM reservations WHERE item_id IN (SELECT item_id FROM items WHERE list_id = ?)`)
					.bind(list_id)
					.run();
				await env.oensker_db.prepare("DELETE FROM items WHERE list_id = ?").bind(list_id).run();
				await env.oensker_db.prepare("DELETE FROM lists WHERE list_id = ?").bind(list_id).run();

				return json({ success: true });
			}

			// GET /admin/lists — Admin dashboard
			if (path === "/admin/lists" && method === "GET") {
				if (url.searchParams.get("auth") !== env.ADMIN_PASSWORD) {
					return json({ error: "Unauthorized" }, 401);
				}
				
				const lists = await env.oensker_db.prepare(
					`SELECT lists.*, creators.name as creator_name, 
					 COUNT(items.item_id) as item_count,
					 SUM(CASE WHEN items.photo_url IS NOT NULL AND items.photo_url != '' THEN 1 ELSE 0 END) as image_count,
					 (SELECT COUNT(DISTINCT ip_address) FROM list_views WHERE list_views.list_id = lists.list_id) as unique_views
					 FROM lists 
					 LEFT JOIN items ON lists.list_id = items.list_id
					 LEFT JOIN creators ON lists.creator_id = creators.creator_id
					 GROUP BY lists.list_id ORDER BY lists.created_at DESC`
				).all();

				const totalLists = lists.results.length;
				const totalItems = lists.results.reduce((sum, l) => sum + l.item_count, 0);
				const totalImages = lists.results.reduce((sum, l) => sum + (l.image_count || 0), 0);

				return json({ lists: lists.results, stats: { totalLists, totalItems, totalImages } });
			}

			return json({ error: "Not found" }, 404);
		} catch (err) {
			return json({ error: err.message }, 500);
		}
	},

	// Scheduled handler — runs daily: resets reservations for passed events,
	// and deletes lists (and their items/reservations) 1 year after their event date
	async scheduled(event, env, ctx) {
		const today = new Date().toISOString().split("T")[0];

		const oneYearAgo = new Date();
		oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
		const oneYearAgoStr = oneYearAgo.toISOString().split("T")[0];

		// Reset reservations for any list whose event has passed
		await env.oensker_db
			.prepare(
				`DELETE FROM reservations
				 WHERE item_id IN (
					 SELECT item_id FROM items
					 WHERE list_id IN (
						 SELECT list_id FROM lists WHERE event_date < ?
					 )
				 )`
			)
			.bind(today)
			.run();

		// Find lists whose event was more than 1 year ago
		const staleLists = await env.oensker_db
			.prepare("SELECT list_id FROM lists WHERE event_date < ?")
			.bind(oneYearAgoStr)
			.all();

		for (const row of staleLists.results) {
			const list_id = row.list_id;
			await env.oensker_db
				.prepare(
					`DELETE FROM reservations WHERE item_id IN (SELECT item_id FROM items WHERE list_id = ?)`
				)
				.bind(list_id)
				.run();
			await env.oensker_db.prepare("DELETE FROM items WHERE list_id = ?").bind(list_id).run();
			await env.oensker_db.prepare("DELETE FROM lists WHERE list_id = ?").bind(list_id).run();
		}
	},
};