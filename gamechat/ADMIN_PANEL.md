# Admin panel preview

The admin frontend is available at `/admin`. The existing game chat remains at `/`.

Use Node 24 (already installed through nvm in this workspace):

```sh
cd gamechat
nvm use 24
npm install
npm run dev
```

Open http://localhost:5173/admin.

The panel uses React, Tailwind CSS, and Lucide icons. All account operations use in-memory mock data; there are no admin backend requests. Reloading resets the sample users. Passwords entered when creating users are validated and discarded.

Includes overview counters, a registration chart calculated from mock account dates, searchable and sortable users, role and inclusive UTC date filters, pagination, account details, creation, profile edits, role changes, deletion confirmations, and current administrator profile editing. Email changes clear verification. Deleting or demoting the final superadmin is blocked. Deleting or demoting your current admin account removes access to the demo until a new demo session is started.

Validation:

```sh
npm run build
npx eslint src/admin src/App.jsx vite.config.js
node --test src/admin/mockService.test.js
```

The full-project lint check currently reports an existing unused variable in `src/components/GameChat.jsx`.
