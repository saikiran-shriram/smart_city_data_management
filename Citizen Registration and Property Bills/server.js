// Smart Solapur - Citizen & Property module (MySQL)
// Backend: Express + mysql2. Serves the frontend from /public and the JSON API under /api.

require('dotenv').config();
const express = require('express');
const path = require('path');
const mysql = require('mysql2/promise');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'citizen_registration_and_bill',
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true,      // DATE columns arrive as 'YYYY-MM-DD' text, no timezone shifts
  decimalNumbers: true,   // DECIMAL columns arrive as numbers
});

/* ------------------------------------------------------------------ helpers */

const q = async (sql, params = []) => (await pool.query(sql, params))[0];

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const bad = (message) => new HttpError(400, message);

function describeDbError(err) {
  const key = ((/for key '(.+?)'/.exec(err.sqlMessage || '') || [])[1] || '').toLowerCase();
  switch (err.code) {
    case 'ER_DUP_ENTRY': {
      let what = 'value';
      if (key.includes('phone')) what = 'phone number';
      else if (key.includes('email')) what = 'email';
      else if (key.includes('doc')) what = 'document number';
      else if (key.includes('bill')) what = 'bill (same property, type and period)';
      return { status: 409, message: `This ${what} already exists.` };
    }
    case 'ER_NO_REFERENCED_ROW':
    case 'ER_NO_REFERENCED_ROW_2':
      return { status: 400, message: 'The linked citizen or property does not exist (foreign key check failed).' };
    case 'ER_ROW_IS_REFERENCED':
    case 'ER_ROW_IS_REFERENCED_2':
      return { status: 409, message: 'Cannot delete: other records still depend on this one. Set ON DELETE CASCADE on the foreign keys to remove them together.' };
    case 'ER_CHECK_CONSTRAINT_VIOLATED':
      return { status: 400, message: `A database rule (CHECK constraint) rejected this value. ${err.sqlMessage || ''}` };
    case 'ER_BAD_NULL_ERROR':
      return { status: 400, message: `A required column was empty. ${err.sqlMessage || ''}` };
    case 'ER_DATA_TOO_LONG':
      return { status: 400, message: `A value is too long for its column. ${err.sqlMessage || ''}` };
    case 'ER_BAD_FIELD_ERROR':
    case 'ER_NO_SUCH_TABLE':
      return { status: 500, message: `Table or column name does not match this app: ${err.sqlMessage}` };
    case 'ECONNREFUSED':
    case 'ER_ACCESS_DENIED_ERROR':
    case 'ER_BAD_DB_ERROR':
    case 'PROTOCOL_CONNECTION_LOST':
      return { status: 503, message: `Cannot reach the database: ${err.message}` };
    default:
  }
  if (err.errno === 4025 || err.errno === 3819) { // MariaDB / MySQL CHECK violation
    return { status: 400, message: `A database rule (CHECK constraint) rejected this value. ${err.sqlMessage || ''}` };
  }
  return { status: 500, message: 'Unexpected server error. Check the terminal running the server.' };
}

const wrap = (fn) => (req, res) =>
  fn(req, res).catch((err) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    const out = describeDbError(err);
    if (out.status >= 500) console.error(err);
    res.status(out.status).json({ error: out.message });
  });

async function withTransaction(work) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await work(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// Optional columns (street, billing_period, area_sqft) are used only if your table has them.
const colCache = {};
async function columns(table) {
  if (!colCache[table]) {
    const rows = await q(
      'SELECT COLUMN_NAME AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
      [table]
    );
    colCache[table] = new Set(rows.map((r) => String(r.c).toLowerCase()));
  }
  return colCache[table];
}

const str = (v) => (typeof v === 'string' ? v.trim() : '');
const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
const mask = (s) => (s && s.length > 4 ? 'X'.repeat(s.length - 4) + s.slice(-4) : s);
const intId = (v, label) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw bad(`Choose a valid ${label}.`);
  return n;
};

const DOC_RULES = {
  Aadhaar: [/^\d{12}$/, 'Aadhaar number must be 12 digits.'],
  PAN: [/^[A-Z]{5}\d{4}[A-Z]$/, 'PAN must look like ABCDE1234F.'],
  VoterID: [/^[A-Z]{3}\d{7}$/, 'Voter ID must look like ABC1234567.'],
};
const PROP_TYPES = ['residential', 'commercial', 'industrial', 'agricultural'];
const BILL_TYPES = ['property_tax', 'water', 'electricity'];

const BILL_STATE = `CASE WHEN b.status = 'paid' THEN 'paid'
                         WHEN b.due_date < CURDATE() THEN 'overdue'
                         ELSE 'unpaid' END`;

/* ------------------------------------------------------------------- health */

app.get('/api/health', wrap(async (req, res) => {
  await q('SELECT 1');
  const [row] = await q('SELECT DATABASE() AS db');
  res.json({ ok: true, database: row.db });
}));

app.get('/api/meta', wrap(async (req, res) => {
  const [a, p, b] = await Promise.all([columns('address'), columns('property'), columns('bill')]);
  res.json({
    address_has_street: a.has('street'),
    property_has_area: p.has('area_sqft'),
    bill_has_period: b.has('billing_period'),
  });
}));

app.get('/api/lookups', wrap(async (req, res) => {
  const citizens = await q('SELECT citizen_id AS id, name FROM citizen ORDER BY name');
  const properties = await q(
    `SELECT p.property_id AS id, p.prop_address AS address, p.owner_id, c.name AS owner_name
     FROM property p JOIN citizen c ON c.citizen_id = p.owner_id ORDER BY p.property_id`
  );
  res.json({ citizens, properties });
}));

/* ---------------------------------------------------------------- dashboard */

app.get('/api/stats', wrap(async (req, res) => {
  const [totals] = await q(
    `SELECT
       (SELECT COUNT(*) FROM citizen) AS citizens,
       (SELECT COUNT(*) FROM property) AS properties,
       (SELECT COUNT(*) FROM bill) AS total_bills,
       (SELECT COUNT(*) FROM bill WHERE status = 'paid') AS paid_bills,
       (SELECT COUNT(*) FROM bill WHERE status <> 'paid' AND due_date >= CURDATE()) AS pending_bills,
       (SELECT COUNT(*) FROM bill WHERE status <> 'paid' AND due_date < CURDATE()) AS overdue_bills,
       (SELECT COALESCE(SUM(amount), 0) FROM bill WHERE status = 'paid') AS total_collected,
       (SELECT COALESCE(SUM(amount), 0) FROM bill WHERE status <> 'paid') AS total_pending,
       (SELECT COALESCE(SUM(amount), 0) FROM bill WHERE status = 'paid' AND bill_type = 'property_tax') AS tax_collected,
       (SELECT COALESCE(SUM(amount), 0) FROM bill WHERE status = 'paid' AND bill_type IN ('water', 'electricity')) AS utility_collected`
  );
  const recent = await q(
    `SELECT citizen_id, name, registration_date FROM citizen
     ORDER BY registration_date DESC, citizen_id DESC LIMIT 5`
  );
  const recent_bills = await q(
    `SELECT b.bill_id, b.bill_type, b.amount, b.due_date, p.prop_address, c.name AS owner_name,
            ${BILL_STATE} AS state
     FROM bill b JOIN property p ON p.property_id = b.prop_id JOIN citizen c ON c.citizen_id = p.owner_id
     ORDER BY b.bill_id DESC LIMIT 5`
  );
  res.json({ totals, recent, recent_bills });
}));

/* ----------------------------------------------------------------- citizens */

app.get('/api/citizens', wrap(async (req, res) => {
  const term = str(req.query.q);
  const like = `%${term}%`;
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 1000, 1), 1000);
  const rows = await q(
    `SELECT c.*,
            (SELECT a.city FROM address a WHERE a.citizen_id = c.citizen_id LIMIT 1) AS city,
            (SELECT COUNT(*) FROM property p WHERE p.owner_id = c.citizen_id) AS properties_owned,
            (SELECT COUNT(*) FROM rental_agreement r WHERE r.tenant_id = c.citizen_id AND r.status = 'active') AS active_rentals
     FROM citizen c
     WHERE (? = '' OR c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ? OR CAST(c.citizen_id AS CHAR) = ?)
     ORDER BY c.citizen_id DESC
     LIMIT ${limit}`,
    [term, like, like, like, term]
  );
  res.json(rows);
}));

app.get('/api/citizens/:id', wrap(async (req, res) => {
  const id = intId(req.params.id, 'citizen');
  const [citizen] = await q('SELECT * FROM citizen WHERE citizen_id = ?', [id]);
  if (!citizen) throw new HttpError(404, 'Citizen not found.');
  const addresses = await q('SELECT * FROM address WHERE citizen_id = ?', [id]);
  const documents = (await q('SELECT * FROM document WHERE citizen_id = ?', [id])).map((d) => ({
    ...d, doc_number: mask(d.doc_number),
  }));
  const owned = await q(
    `SELECT p.*, (SELECT COUNT(*) FROM bill b WHERE b.prop_id = p.property_id AND b.status <> 'paid') AS unpaid_bills
     FROM property p WHERE p.owner_id = ?`, [id]
  );
  const renting = await q(
    `SELECT r.*, p.prop_address FROM rental_agreement r
     JOIN property p ON p.property_id = r.prop_id WHERE r.tenant_id = ? ORDER BY r.start_date DESC`, [id]
  );
  res.json({ citizen, addresses, documents, owned, renting });
}));

app.get('/api/citizens/:id/impact', wrap(async (req, res) => {
  const id = intId(req.params.id, 'citizen');
  const [row] = await q(
    `SELECT
       (SELECT COUNT(*) FROM address WHERE citizen_id = ?) AS addresses,
       (SELECT COUNT(*) FROM document WHERE citizen_id = ?) AS documents,
       (SELECT COUNT(*) FROM property WHERE owner_id = ?) AS properties,
       (SELECT COUNT(*) FROM bill WHERE prop_id IN (SELECT property_id FROM property WHERE owner_id = ?)) AS bills,
       (SELECT COUNT(*) FROM rental_agreement
          WHERE tenant_id = ? OR prop_id IN (SELECT property_id FROM property WHERE owner_id = ?)) AS rentals`,
    [id, id, id, id, id, id]
  );
  res.json(row);
}));

// Register a citizen + address (+ optional document) as ONE transaction.
app.post('/api/citizens', wrap(async (req, res) => {
  const b = req.body || {};
  const a = b.address || {};
  const d = b.document || {};

  const name = str(b.name);
  const email = str(b.email);
  const phone = str(b.phone);
  const gender = str(b.gender).toUpperCase();
  const dob = str(b.dob);
  if (name.length < 2 || name.length > 50) throw bad('Enter the full name (2 to 50 characters).');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw bad('Enter a valid email address.');
  if (!/^\d{10}$/.test(phone)) throw bad('Phone number must be exactly 10 digits.');
  if (!['M', 'F', 'O'].includes(gender)) throw bad('Choose a gender.');
  if (!isDate(dob) || new Date(dob) > new Date()) throw bad('Enter a valid date of birth.');

  const area = str(a.area), city = str(a.city), state = str(a.state), pincode = str(a.pincode), street = str(a.street);
  if (!area || !city || !state) throw bad('Area, city and state are required.');
  if (!/^\d{6}$/.test(pincode)) throw bad('Pincode must be exactly 6 digits.');

  const docType = str(d.doc_type);
  const docNumber = str(d.doc_number).toUpperCase().replace(/\s+/g, '');
  if (docType || docNumber) {
    const rule = DOC_RULES[docType];
    if (!rule) throw bad('Choose a document type.');
    if (!rule[0].test(docNumber)) throw bad(rule[1]);
  }

  const acols = await columns('address');
  const newId = await withTransaction(async (conn) => {
    const [ins] = await conn.query(
      'INSERT INTO citizen (name, email, phone, gender, dob, registration_date) VALUES (?, ?, ?, ?, ?, CURDATE())',
      [name, email || null, phone, gender, dob]
    );
    const citizenId = ins.insertId;
    const fields = ['citizen_id', 'area', 'city', 'state', 'pincode'];
    const vals = [citizenId, area, city, state, pincode];
    if (acols.has('street')) { fields.push('street'); vals.push(street || null); }
    await conn.query(`INSERT INTO address (${fields.join(', ')}) VALUES (?)`, [vals]);
    if (docType) {
      await conn.query('INSERT INTO document (citizen_id, doc_type, doc_number) VALUES (?, ?, ?)',
        [citizenId, docType, docNumber]);
    }
    return citizenId;
  });
  res.status(201).json({ citizen_id: newId });
}));

app.delete('/api/citizens/:id', wrap(async (req, res) => {
  const id = intId(req.params.id, 'citizen');
  const [result] = await pool.query('DELETE FROM citizen WHERE citizen_id = ?', [id]);
  if (!result.affectedRows) throw new HttpError(404, 'Citizen not found.');
  res.json({ deleted: id });
}));

/* --------------------------------------------------------------- properties */

app.get('/api/properties', wrap(async (req, res) => {
  const term = str(req.query.q);
  const like = `%${term}%`;
  const rows = await q(
    `SELECT p.*, c.name AS owner_name,
            (SELECT t.name FROM rental_agreement r JOIN citizen t ON t.citizen_id = r.tenant_id
               WHERE r.prop_id = p.property_id AND r.status = 'active'
               ORDER BY r.start_date DESC LIMIT 1) AS tenant_name,
            (SELECT COUNT(*) FROM bill b WHERE b.prop_id = p.property_id) AS bills_total,
            (SELECT COALESCE(SUM(b.amount), 0) FROM bill b WHERE b.prop_id = p.property_id AND b.status <> 'paid') AS pending_amount
     FROM property p JOIN citizen c ON c.citizen_id = p.owner_id
     WHERE (? = '' OR p.prop_address LIKE ? OR c.name LIKE ? OR p.prop_type LIKE ?)
     ORDER BY p.property_id DESC`,
    [term, like, like, like]
  );
  res.json(rows);
}));

app.get('/api/properties/:id', wrap(async (req, res) => {
  const id = intId(req.params.id, 'property');
  const [property] = await q(
    `SELECT p.*, c.name AS owner_name, c.phone AS owner_phone
     FROM property p JOIN citizen c ON c.citizen_id = p.owner_id WHERE p.property_id = ?`, [id]
  );
  if (!property) throw new HttpError(404, 'Property not found.');
  const rentals = await q(
    `SELECT r.*, t.name AS tenant_name FROM rental_agreement r
     JOIN citizen t ON t.citizen_id = r.tenant_id WHERE r.prop_id = ? ORDER BY r.start_date DESC`, [id]
  );
  const bills = await q(
    `SELECT b.*, ${BILL_STATE} AS state FROM bill b WHERE b.prop_id = ? ORDER BY b.due_date DESC`, [id]
  );
  res.json({ property, rentals, bills });
}));

app.post('/api/properties', wrap(async (req, res) => {
  const b = req.body || {};
  const ownerId = intId(b.owner_id, 'owner');
  const type = str(b.prop_type);
  const address = str(b.prop_address);
  if (!PROP_TYPES.includes(type)) throw bad('Choose a property type.');
  if (address.length < 5 || address.length > 150) throw bad('Enter the property address (5 to 150 characters).');

  const pcols = await columns('property');
  const fields = ['owner_id', 'prop_type', 'prop_address'];
  const vals = [ownerId, type, address];
  if (pcols.has('area_sqft') && b.area_sqft !== undefined && b.area_sqft !== '') {
    const area = Number(b.area_sqft);
    if (!(area > 0)) throw bad('Area must be a positive number.');
    fields.push('area_sqft'); vals.push(area);
  }
  const [ins] = await pool.query(`INSERT INTO property (${fields.join(', ')}) VALUES (?)`, [vals]);
  res.status(201).json({ property_id: ins.insertId });
}));

/* ------------------------------------------------------------------ rentals */

app.get('/api/rentals', wrap(async (req, res) => {
  const rows = await q(
    `SELECT r.*, p.prop_address, o.name AS owner_name, t.name AS tenant_name
     FROM rental_agreement r
     JOIN property p ON p.property_id = r.prop_id
     JOIN citizen o ON o.citizen_id = p.owner_id
     JOIN citizen t ON t.citizen_id = r.tenant_id
     ORDER BY (r.status = 'active') DESC, r.start_date DESC`
  );
  res.json(rows);
}));

app.post('/api/rentals', wrap(async (req, res) => {
  const b = req.body || {};
  const propId = intId(b.prop_id, 'property');
  const tenantId = intId(b.tenant_id, 'tenant');
  const start = str(b.start_date);
  const end = str(b.end_date);
  const rent = Number(b.monthly_rent);
  if (!isDate(start)) throw bad('Enter a valid start date.');
  if (end && (!isDate(end) || end < start)) throw bad('End date must be on or after the start date.');
  if (!(rent > 0)) throw bad('Monthly rent must be more than zero.');

  const id = await withTransaction(async (conn) => {
    const [[prop]] = await conn.query('SELECT owner_id FROM property WHERE property_id = ? FOR UPDATE', [propId]);
    if (!prop) throw new HttpError(404, 'Property not found.');
    if (prop.owner_id === tenantId) throw bad('The owner cannot be the tenant of their own property.');
    const [[active]] = await conn.query(
      "SELECT COUNT(*) AS n FROM rental_agreement WHERE prop_id = ? AND status = 'active'", [propId]
    );
    if (active.n > 0) throw new HttpError(409, 'This property already has an active rental. End it first.');
    const [ins] = await conn.query(
      `INSERT INTO rental_agreement (prop_id, tenant_id, start_date, end_date, monthly_rent, status)
       VALUES (?, ?, ?, ?, ?, 'active')`,
      [propId, tenantId, start, end || null, rent]
    );
    return ins.insertId;
  });
  res.status(201).json({ rental_id: id });
}));

app.post('/api/rentals/:id/end', wrap(async (req, res) => {
  const id = intId(req.params.id, 'rental');
  const [result] = await pool.query(
    `UPDATE rental_agreement
     SET status = 'ended', end_date = CASE WHEN end_date IS NULL OR end_date > CURDATE() THEN CURDATE() ELSE end_date END
     WHERE rental_id = ? AND status = 'active'`, [id]
  );
  if (!result.affectedRows) throw new HttpError(409, 'This rental is not active.');
  res.json({ ended: id });
}));

/* -------------------------------------------------------------------- bills */

app.get('/api/bills', wrap(async (req, res) => {
  const state = str(req.query.status);
  const type = str(req.query.type);
  const term = str(req.query.q);
  const where = [];
  const params = [];
  if (state === 'paid') where.push("b.status = 'paid'");
  if (state === 'unpaid') where.push("b.status <> 'paid' AND b.due_date >= CURDATE()");
  if (state === 'overdue') where.push("b.status <> 'paid' AND b.due_date < CURDATE()");
  if (BILL_TYPES.includes(type)) { where.push('b.bill_type = ?'); params.push(type); }
  if (term) {
    where.push('(p.prop_address LIKE ? OR c.name LIKE ? OR CAST(b.bill_id AS CHAR) = ?)');
    params.push(`%${term}%`, `%${term}%`, term);
  }
  const rows = await q(
    `SELECT b.*, p.prop_address, c.name AS owner_name, ${BILL_STATE} AS state
     FROM bill b JOIN property p ON p.property_id = b.prop_id JOIN citizen c ON c.citizen_id = p.owner_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY (b.status = 'paid'), b.due_date`,
    params
  );
  res.json(rows);
}));

app.post('/api/bills', wrap(async (req, res) => {
  const b = req.body || {};
  const propId = intId(b.prop_id, 'property');
  const type = str(b.bill_type);
  const amount = Number(b.amount);
  const due = str(b.due_date);
  const period = str(b.billing_period) || due.slice(0, 7);
  if (!BILL_TYPES.includes(type)) throw bad('Choose a bill type.');
  if (!(amount > 0) || amount > 99999999) throw bad('Amount must be more than zero.');
  if (!isDate(due)) throw bad('Enter a valid due date.');
  if (!/^\d{4}-\d{2}$/.test(period)) throw bad('Billing period must look like 2026-10.');

  const bcols = await columns('bill');
  const fields = ['prop_id', 'bill_type', 'amount', 'due_date', 'status'];
  const vals = [propId, type, amount, due, 'unpaid'];
  if (bcols.has('billing_period')) { fields.push('billing_period'); vals.push(period); }
  const [ins] = await pool.query(`INSERT INTO bill (${fields.join(', ')}) VALUES (?)`, [vals]);
  res.status(201).json({ bill_id: ins.insertId });
}));

// Pay a bill: lock the row, check it, update it, commit (ACID).
app.post('/api/bills/:id/pay', wrap(async (req, res) => {
  const id = intId(req.params.id, 'bill');
  const receipt = await withTransaction(async (conn) => {
    const [[bill]] = await conn.query('SELECT * FROM bill WHERE bill_id = ? FOR UPDATE', [id]);
    if (!bill) throw new HttpError(404, 'Bill not found.');
    if (bill.status === 'paid') throw new HttpError(409, 'This bill is already paid.');
    await conn.query("UPDATE bill SET status = 'paid', payment_date = CURDATE() WHERE bill_id = ?", [id]);
    const [[row]] = await conn.query(
      `SELECT b.*, p.prop_address, c.name AS owner_name
       FROM bill b JOIN property p ON p.property_id = b.prop_id JOIN citizen c ON c.citizen_id = p.owner_id
       WHERE b.bill_id = ?`, [id]
    );
    return row;
  });
  res.json({ receipt });
}));

/* ------------------------------------------------------------------ reports */

app.get('/api/reports/monthly', wrap(async (req, res) => {
  const rows = await q(
    `SELECT DATE_FORMAT(payment_date, '%Y-%m') AS month, bill_type, SUM(amount) AS total, COUNT(*) AS bills
     FROM bill WHERE status = 'paid' AND payment_date IS NOT NULL
     GROUP BY month, bill_type ORDER BY month DESC, bill_type`
  );
  res.json(rows);
}));

app.use('/api', (req, res) => res.status(404).json({ error: 'Unknown API route.' }));

const PORT = Number(process.env.PORT || 3001);
app.listen(PORT, () => console.log(`Smart Solapur is running at http://localhost:${PORT}`));
