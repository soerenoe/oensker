# Oensker

A shareable wishlist app with anonymous reservations — no accounts, no snooping, no clutter.

**You create a list, share a link, and guests reserve items in two clicks.**  
The list owner never sees who reserved what, so surprises stay surprises.

---

## What makes it different

- **Creator-blind by design** — The creator’s dashboard deliberately excludes reservation info. It's enforced structurally in the database queries, not just hidden in the UI.
- **No accounts** — Guest identity is a random token stored in their browser; the creator gets a secret link. Nothing to sign up for.
- **2‑click reserve/cancel** — Click an item, click Reserve. That’s it.
- **Self‑expiring data** — Lists automatically reset reservations after the event date passes, and are fully deleted one year later. No stale data left behind.
- **Minimal, focused** — On core elements: Name, price, remark, link, and an event date.

---

## How it works

- **Creator link** — Add, edit, or delete items. Never sees reservations.
- **Guest link** — See items with live availability badges, reserve or cancel in two clicks.
- **Manual delete** — The creator can delete their list anytime via a confirmation dialog (hard to do by accident, easy when intended).

---

## Deploy your own

Oensker runs entirely on [Cloudflare Workers](https://workers.cloudflare.com/) with a [D1](https://developers.cloudflare.com/d1/) database (SQLite). It fits comfortably in the free tier.

### Prerequisites

- A Cloudflare account
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (v4+)
- A D1 database (create via `wrangler d1 create oensker-db`)

### Quick start

1. Clone the repo
2. Run the schema migrations against your D1 database (see `schema.sql` and `migration_add_creator_name.sql`)
3. Update `wrangler.jsonc` with your database ID
4. Deploy: `npx wrangler deploy`

That’s it. You’ll get your own wishlist app at your own domain or a `*.workers.dev` URL.

*For detailed Cloudflare setup, refer to the [Workers documentation](https://developers.cloudflare.com/workers/) and [Wrangler CLI docs](https://developers.cloudflare.com/workers/wrangler/commands/).*

---

## License

MIT — do what you want. See [LICENSE](LICENSE) for the full text.

---

## Why "Oensker"?

Oensker means "wishes" in Danish.  
Built for sharing wishlists with friends and family - no accounts, no setup, just a link that anyone can open and use straight away. It also serves as a real-world deployed project demonstrating CI/CD and modern cloud architecture — but mostly, it’s just useful.

---

## 🔒 Privacy

No tracking, no analytics, no cookies beyond the anonymous guest token (stored in your browser). The app is self‑hosted on your own Cloudflare account, so you own your data completely.
