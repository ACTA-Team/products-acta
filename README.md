# ACTA Products

A Next.js repository that showcases **products in the ACTA ecosystem** and explains, for each one, the problems they face and how ACTA solves them. It acts as a living catalog of use cases, pain points, and the ACTA-powered solutions that address them.

## What's in this repo

- `src/` — Next.js App Router pages and components that render the products catalog and per-product case studies.
- `public/` — Static assets (logos, screenshots, diagrams).
- Next.js 16 + React 19 + Tailwind CSS 4 setup.

## For developers: fork & clone

If you plan to contribute, first **fork** this repository from GitHub into your own account, then clone your fork locally:

```bash
git clone https://github.com/<your-username>/acta-products.git
cd acta-products
git remote add upstream https://github.com/acta-org/acta-products.git
```

If you only want to run the project locally (no contributions), you can clone it directly:

```bash
git clone https://github.com/acta-org/acta-products.git
cd acta-products
```

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the site.

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run start` — run the production build
- `npm run lint` — lint the codebase
- `npm run format` — format with Prettier
