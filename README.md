# Smart Solapur - Citizen and Property module (MySQL)

Web app for the MySQL half of the Smart City project: **Citizen Registration** and
**Property Tax & Utility Bills** (plus tenants through rental agreements).

Stack: Node.js + Express (backend), mysql2 (driver), plain HTML/CSS/JS (frontend).
It uses the same Node setup as the MongoDB and Neo4j parts, so all three can be merged later.

## Run it

1. Install Node.js (version 18 or newer) and make sure your MySQL server is running.
2. In this folder:
   ```
   npm install
   copy .env.example .env        (Windows)     cp .env.example .env   (Mac/Linux)
   ```
3. Open `.env` and put your own MySQL password. `DB_NAME` must be the database that holds
   your 6 tables (`citizen_registration_and_bill` if you kept the name shown in `SHOW TABLES`).
4. Start:
   ```
   npm start
   ```
5. Open http://localhost:3001

Port 3001 is used on purpose so it does not clash with another app on port 3000.
The "Connected to ..." pill in the top right turns green when the database is reachable.

`database/schema.sql` is only for a brand-new database (tables + sample data).
Your existing database already has the same tables, so do not run it there.

## Pages

| Page | What it does | MySQL concepts it shows |
|---|---|---|
| Dashboard | Collected vs pending money, bills by status and type, due next | aggregates, GROUP BY, subqueries |
| Citizens | Search, full profile, delete with impact preview | JOINs, ON DELETE CASCADE |
| Register citizen | Citizen + address + document in one go | one transaction, UNIQUE, CHECK |
| Properties | Owner, current tenant, pending dues, bills per property | 1:N, JOINs |
| Rentals | Create and end rental agreements | M:N through Rental_Agreement |
| Bills | Filter, generate, pay, print receipt | transaction + row lock (ACID) |

## Table and column names the app expects

`citizen(citizen_id, name, email, phone, gender, dob, registration_date)`
`address(citizen_id, area, city, state, pincode)` (an optional `street` column is used if it exists)
`document(citizen_id, doc_type, doc_number)`
`property(property_id, owner_id, prop_type, prop_address)` (optional `area_sqft`)
`rental_agreement(rental_id, prop_id, tenant_id, start_date, end_date, monthly_rent, status)`
`bill(bill_id, prop_id, bill_type, amount, billing_period, due_date, payment_date, status)`

Allowed values used by the forms: gender M/F/O; property types residential, commercial,
industrial, agricultural; bill types property_tax, water, electricity; document types
Aadhaar, PAN, VoterID. If one of your CHECK constraints allows different values, the app shows
the database error on screen. Change the list in `public/script.js` and `server.js` to match.

## Good things to say in the viva

- **Transaction:** registering a citizen inserts into 3 tables; if any insert fails (for example a
  duplicate Aadhaar) the whole registration is rolled back. Paying a bill locks the row with
  `SELECT ... FOR UPDATE`, checks it is unpaid, updates it and commits, so a bill can never be paid twice.
- **Cascade:** deleting a citizen shows exactly what will be removed with it before you confirm.
- **Security:** Aadhaar and PAN numbers are masked in the screen (only the last 4 characters show),
  every query uses placeholders (no SQL injection), and all text is escaped in the browser.
- **Overdue:** a bill is shown as overdue when it is unpaid and past its due date. This is
  calculated in the query, so no extra column or job is needed.

## API (used by the pages)

GET `/api/stats` `/api/citizens` `/api/citizens/:id` `/api/citizens/:id/impact` `/api/properties`
`/api/properties/:id` `/api/rentals` `/api/bills?status=&type=&q=` `/api/reports/monthly`
POST `/api/citizens` `/api/properties` `/api/rentals` `/api/rentals/:id/end` `/api/bills` `/api/bills/:id/pay`
DELETE `/api/citizens/:id`
