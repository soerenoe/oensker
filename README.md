# Oensker

A shareable wish list app with no accounts needed.

**You create a list, share a link, and guests reserve items in two clicks.**  
The list owner never sees who reserved what.

---

## What makes it different

- **Creator-blind by design** — The creator’s dashboard deliberately excludes reservation info. It is enforced structurally in the database queries, not just hidden in the UI.
- **No accounts** — Guest identity is a random token stored in their browser; the creator gets a secret link.
- **2‑click guest reserve/cancel** — Click an item, click Reserve.
- **Self‑expiring data** — Lists automatically reset reservations after the event date passes, and are fully deleted one year later. No stale data left behind. If you want to keep your list alive, you need to update it at least once a year.
- **Minimal, focused** — On core elements: Name, price, remark, link, and an event date.

---

## How it works

- **Creator link** — Add, edit, or delete items. Never sees reservations.
- **Guest link** — See items with live availability badges, reserve or cancel in two clicks.
- **Manual delete** — The creator can delete their list anytime via a confirmation dialog. The list creator has to delete items from the list themselves, as a reservation is no guarantee that the item is no longer relevant after the event date has passed.

---

## Deploy your own

Oensker runs entirely on [Cloudflare Workers](https://workers.cloudflare.com/) with a [D1](https://developers.cloudflare.com/d1/) database (SQLite). It fits comfortably in the free tier.

### Host prerequisites

- A Cloudflare account
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (v4+)
- A D1 database (create via `wrangler d1 create oensker-db`)

### Quick start

1. Clone the repo
2. Run the schema migrations against your D1 database (see `schema.sql` and `migration_add_creator_name.sql`)
3. Update `wrangler.jsonc` with your database ID
4. Deploy: `npx wrangler deploy`

You will then get your own wish list app at your own domain or a `*.workers.dev` URL.

*For detailed Cloudflare setup, refer to the [Workers documentation](https://developers.cloudflare.com/workers/) and [Wrangler CLI docs](https://developers.cloudflare.com/workers/wrangler/commands/).*

---

## License

MIT — do what you want. See [LICENSE](LICENSE) for the full text.

---

## Why

Built for sharing wishlists with friends and family - no accounts, no setup, just a link that anyone can open and use straight away. The project is built on a serverless stack with an automated CI/CD pipeline, and is designed to be the most accessible wish list sharing tool: You will be the host, which takes a bit of initial setup, but everyone you share it with can easily make and share their own lists.

---

## Privacy

No tracking, no analytics, no cookies beyond the anonymous guest token (stored in your browser). The app is self‑hosted on your own Cloudflare account, so you own your data.
