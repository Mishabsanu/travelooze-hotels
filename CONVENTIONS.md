# Hotel Manager — code conventions

Built on the same architecture and UI as **Proserve ERP** (`D:\AKOD ERP\proserve`): purple `#5439a3` header,
navy rail, compact grid tables, role-based permission matrix. When in doubt, copy how Proserve does it.

**Hard rule: no file over 500 lines.**

## Folder map

| Path | What goes there |
|---|---|
| `src/lib/` | Shared by client **and** server: `permissions.ts`, `bookingAccess.ts`, `constants.ts` (meal plans, GST slabs), `pricing.ts`, `types.ts`, `hotelTypes.ts`, `validation/*.schema.ts` (Yup) |
| `src/server/models/` | Mongoose models (`models.X \|\| model(...)`) |
| `src/server/services/` | Business logic + queries. `booking/` holds availability, create, and actions (check-in/out, cancel, payments, ID files) |
| `src/server/http/` | `apiHandler` (session + permission + errors), `readBody`, `parseListQuery`, `paginate`, `listSort` |
| `src/app/api/**/route.ts` | Thin handlers: `apiHandler({ module, action }, …)` → service |
| `src/app/dashboard/**/page.tsx` | One-line pages that render an `XPages.tsx` server component |
| `src/components/{ui,table,forms,layout,roles,users}` | Copied from Proserve — keep them in sync |
| `src/components/{bookings,property,sales,overview,reports}` | Hotel modules: `XListView` (DataTable), `XForm` (Formik), `XPages` (server) |

## Access rules

- **Permissions** (`src/lib/permissions.ts`): module × view/create/update/delete, edited in Admin → Roles & Permissions.
  Adding a module there adds it to the role matrix automatically. Super Admin = every permission.
- **Hotels**: every user has `allHotels` or a list of `hotels`. Lists and records are filtered with `hotelScope(user)` /
  `assertHotelAccess(user, hotelId)`. Super Admin always sees all hotels.
- **Bookings**: walk-ins use `booking`, agent bookings use `agent_booking` (`canBooking()` in `lib/bookingAccess.ts`,
  same function in API and UI). Check-in/out = `check_in_out.update`, payments = `payment.create`,
  Aadhaar files = `guest_id` (view = open, create = upload).
- **Double booking** is blocked by the unique `(room, date)` index on `roomnights`; never write bookings without
  `holdRoomNights()`.
- Aadhaar: only the last 4 digits are stored. ID files are uploaded to **Cloudinary as private (authenticated)** assets
  (`src/server/storage.ts`) and only served by `/api/bookings/:id/id-files/:index` after the permission + hotel check.
- Database: MongoDB Atlas, database `travelooze_hotels` (use the standard `mongodb://` string: Node on this PC cannot resolve `mongodb+srv://`).

## Notes

- Tailwind **v3** (not v4 like Proserve): Windows Application Control blocks v4's native scanner on this machine.
  Proserve's theme tokens (`brand`, `rail`, `line`, `head`, `canvas`) are in `tailwind.config.ts`.
- Next 16: `params` / `searchParams` are Promises; `proxy.ts` replaces middleware.

## Commands

The database (Atlas `travelooze_hotels`) already holds the 5 default roles and the Super Admin login; there are no seed scripts.
Add real hotels, room types, rooms, agents and staff from the app (Property, B2B Sales, Admin).

```
npm run dev                 # http://localhost:3000
npm run typecheck
npm run build
```
