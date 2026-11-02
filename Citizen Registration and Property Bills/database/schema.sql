-- Smart Solapur: Citizen Registration + Property Tax & Utility Bills (MySQL)
-- Use this only on a fresh database. Your existing tables already match it.
-- Order: parents first, children after.

CREATE DATABASE IF NOT EXISTS citizen_registration_and_bill;
USE citizen_registration_and_bill;

CREATE TABLE citizen (
  citizen_id        INT AUTO_INCREMENT PRIMARY KEY,
  name              VARCHAR(50)  NOT NULL,
  email             VARCHAR(100) UNIQUE,
  phone             CHAR(10)     NOT NULL UNIQUE,
  gender            CHAR(1)      NOT NULL,
  dob               DATE         NOT NULL,
  registration_date DATE         NOT NULL,
  CONSTRAINT chk_gender CHECK (gender IN ('M','F','O'))
);

CREATE TABLE address (
  add_id     INT AUTO_INCREMENT PRIMARY KEY,
  citizen_id INT         NOT NULL,
  area       VARCHAR(50) NOT NULL,
  city       VARCHAR(50) NOT NULL,
  state      VARCHAR(50) NOT NULL,
  pincode    CHAR(6)     NOT NULL,
  CONSTRAINT fk_address_citizen FOREIGN KEY (citizen_id)
    REFERENCES citizen(citizen_id) ON DELETE CASCADE
);

CREATE TABLE document (
  doc_id     INT AUTO_INCREMENT PRIMARY KEY,
  citizen_id INT         NOT NULL,
  doc_type   VARCHAR(20) NOT NULL,
  doc_number VARCHAR(20) NOT NULL,
  CONSTRAINT fk_document_citizen FOREIGN KEY (citizen_id)
    REFERENCES citizen(citizen_id) ON DELETE CASCADE,
  CONSTRAINT uq_document UNIQUE (doc_type, doc_number)
);

CREATE TABLE property (
  property_id      INT AUTO_INCREMENT PRIMARY KEY,
  owner_id         INT          NOT NULL,
  prop_type        VARCHAR(20)  NOT NULL,
  prop_address VARCHAR(150) NOT NULL,
  CONSTRAINT fk_property_owner FOREIGN KEY (owner_id)
    REFERENCES citizen(citizen_id) ON DELETE CASCADE,
  CONSTRAINT chk_prop_type CHECK (prop_type IN ('residential','commercial','industrial','agricultural'))
);

CREATE TABLE rental_agreement (
  rental_id    INT AUTO_INCREMENT PRIMARY KEY,
  prop_id      INT           NOT NULL,
  tenant_id    INT           NOT NULL,
  start_date   DATE          NOT NULL,
  end_date     DATE          NULL,
  monthly_rent DECIMAL(10,2) NOT NULL,
  status       VARCHAR(10)   NOT NULL DEFAULT 'active',
  CONSTRAINT fk_rental_property FOREIGN KEY (prop_id)
    REFERENCES property(property_id) ON DELETE CASCADE,
  CONSTRAINT fk_rental_tenant FOREIGN KEY (tenant_id)
    REFERENCES citizen(citizen_id) ON DELETE CASCADE,
  CONSTRAINT chk_rental_dates CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE TABLE bill (
  bill_id        INT AUTO_INCREMENT PRIMARY KEY,
  prop_id        INT           NOT NULL,
  bill_type      VARCHAR(20)   NOT NULL,
  amount         DECIMAL(10,2) NOT NULL,
  billing_period CHAR(7)       NOT NULL,
  due_date       DATE          NOT NULL,
  payment_date   DATE          NULL,
  status         VARCHAR(10)   NOT NULL DEFAULT 'unpaid',
  CONSTRAINT fk_bill_property FOREIGN KEY (prop_id)
    REFERENCES property(property_id) ON DELETE CASCADE,
  CONSTRAINT chk_bill_type   CHECK (bill_type IN ('property_tax','water','electricity')),
  CONSTRAINT chk_bill_status CHECK (status IN ('paid','unpaid','overdue')),
  CONSTRAINT chk_bill_amount CHECK (amount > 0),
  CONSTRAINT uq_bill UNIQUE (prop_id, bill_type, billing_period)
);

-- ---------- Sample data ----------
INSERT INTO citizen (citizen_id, name, email, phone, gender, dob, registration_date) VALUES
(1, 'Ramesh Patil',   'ramesh.patil@example.com',   '9876543210', 'M', '1985-04-12', '2026-01-10'),
(2, 'Amit Jadhav',    'amit.jadhav@example.com',    '9123456780', 'M', '1992-08-25', '2026-01-15'),
(3, 'Sneha Kulkarni', 'sneha.kulkarni@example.com', '9988776655', 'F', '1990-11-03', '2026-02-01');

INSERT INTO address (add_id, citizen_id, area, city, state, pincode) VALUES
(1, 1, 'Navi Peth',    'Solapur', 'Maharashtra', '413001'),
(2, 2, 'Saat Rasta',   'Solapur', 'Maharashtra', '413003'),
(3, 3, 'Jule Solapur', 'Solapur', 'Maharashtra', '413004');

INSERT INTO document (doc_id, citizen_id, doc_type, doc_number) VALUES
(1, 1, 'Aadhaar', '123456789012'),
(2, 1, 'PAN',     'ABCDE1234F'),
(3, 2, 'Aadhaar', '987654321098');

INSERT INTO property (property_id, owner_id, prop_type, prop_address) VALUES
(1, 1, 'residential', 'Plot 12, Navi Peth, Solapur'),
(2, 3, 'commercial',  'Shop 4, Market Road, Solapur');

INSERT INTO rental_agreement (rental_id, prop_id, tenant_id, start_date, end_date, monthly_rent, status) VALUES
(1, 1, 2, '2026-01-01', '2026-12-31', 12000.00, 'active');

INSERT INTO bill (bill_id, prop_id, bill_type, amount, billing_period, due_date, payment_date, status) VALUES
(1, 1, 'property_tax', 4500.00, '2026-04', '2026-06-30', '2026-06-10', 'paid'),
(2, 1, 'water',         350.00, '2026-10', '2026-11-15', NULL,         'unpaid'),
(3, 2, 'electricity',  2200.00, '2026-10', '2026-11-10', NULL,         'unpaid');
