-- 001: esquema inicial.
-- Montos: INTEGER en unidad mínima (centavos). Meses: TEXT 'YYYY-MM'. Fechas: TEXT 'YYYY-MM-DD'.
-- Timestamps: TEXT ISO-8601 UTC.

CREATE TABLE categories (
  id          INTEGER PRIMARY KEY,
  name        TEXT    NOT NULL COLLATE NOCASE UNIQUE CHECK (length(trim(name)) BETWEEN 1 AND 60),
  icon        TEXT    NOT NULL DEFAULT 'tag',
  color       TEXT    NOT NULL DEFAULT '#64748b' CHECK (color GLOB '#[0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F]'),
  sort_order  INTEGER NOT NULL DEFAULT 0,
  archived_at TEXT,
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE subcategories (
  id          INTEGER PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES categories (id) ON DELETE RESTRICT,
  name        TEXT    NOT NULL COLLATE NOCASE CHECK (length(trim(name)) BETWEEN 1 AND 60),
  sort_order  INTEGER NOT NULL DEFAULT 0,
  archived_at TEXT,
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (category_id, name)
);
CREATE INDEX idx_subcategories_category ON subcategories (category_id);

CREATE TABLE payment_methods (
  id          INTEGER PRIMARY KEY,
  name        TEXT    NOT NULL COLLATE NOCASE UNIQUE CHECK (length(trim(name)) BETWEEN 1 AND 60),
  type        TEXT    NOT NULL CHECK (type IN ('efectivo', 'debito', 'transferencia', 'tarjeta_credito')),
  closing_day INTEGER CHECK (closing_day BETWEEN 1 AND 31),
  due_day     INTEGER CHECK (due_day BETWEEN 1 AND 31),
  color       TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  archived_at TEXT,
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (type <> 'tarjeta_credito' OR closing_day IS NOT NULL),
  CHECK (type = 'tarjeta_credito' OR (closing_day IS NULL AND due_day IS NULL))
);

CREATE TABLE installment_plans (
  id                 INTEGER PRIMARY KEY,
  description        TEXT    NOT NULL DEFAULT '',
  subcategory_id     INTEGER NOT NULL REFERENCES subcategories (id) ON DELETE RESTRICT,
  payment_method_id  INTEGER NOT NULL REFERENCES payment_methods (id) ON DELETE RESTRICT,
  purchase_date      TEXT    NOT NULL CHECK (purchase_date GLOB '[0-9][0-9][0-9][0-9]-[01][0-9]-[0-3][0-9]'),
  total_cents        INTEGER NOT NULL CHECK (total_cents > 0),
  installments_count INTEGER NOT NULL CHECK (installments_count BETWEEN 2 AND 120),
  first_charge_month TEXT    NOT NULL CHECK (first_charge_month GLOB '[0-9][0-9][0-9][0-9]-[01][0-9]'),
  created_at         TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE recurring_templates (
  id                   INTEGER PRIMARY KEY,
  description          TEXT    NOT NULL CHECK (length(trim(description)) BETWEEN 1 AND 120),
  subcategory_id       INTEGER NOT NULL REFERENCES subcategories (id) ON DELETE RESTRICT,
  payment_method_id    INTEGER NOT NULL REFERENCES payment_methods (id) ON DELETE RESTRICT,
  default_amount_cents INTEGER CHECK (default_amount_cents >= 0),
  day_of_month         INTEGER NOT NULL CHECK (day_of_month BETWEEN 1 AND 31),
  start_month          TEXT    NOT NULL CHECK (start_month GLOB '[0-9][0-9][0-9][0-9]-[01][0-9]'),
  end_month            TEXT    CHECK (end_month GLOB '[0-9][0-9][0-9][0-9]-[01][0-9]'),
  active               INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at           TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (end_month IS NULL OR end_month >= start_month)
);

CREATE TABLE expenses (
  id                    INTEGER PRIMARY KEY,
  subcategory_id        INTEGER NOT NULL REFERENCES subcategories (id) ON DELETE RESTRICT,
  payment_method_id     INTEGER NOT NULL REFERENCES payment_methods (id) ON DELETE RESTRICT,
  description           TEXT    NOT NULL DEFAULT '' CHECK (length(description) <= 200),
  purchase_date         TEXT    NOT NULL CHECK (purchase_date GLOB '[0-9][0-9][0-9][0-9]-[01][0-9]-[0-3][0-9]'),
  charge_month          TEXT    NOT NULL CHECK (charge_month GLOB '[0-9][0-9][0-9][0-9]-[01][0-9]'),
  -- 1 si el usuario corrigió el mes de imputación a mano: no se recalcula al editar la fecha.
  charge_month_locked   INTEGER NOT NULL DEFAULT 0 CHECK (charge_month_locked IN (0, 1)),
  -- NULL = pendiente de cargar (distinto de $0).
  amount_cents          INTEGER CHECK (amount_cents >= 0),
  installment_plan_id   INTEGER REFERENCES installment_plans (id) ON DELETE CASCADE,
  installment_number    INTEGER CHECK (installment_number >= 1),
  recurring_template_id INTEGER REFERENCES recurring_templates (id) ON DELETE SET NULL,
  notes                 TEXT CHECK (length(notes) <= 1000),
  created_at            TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at            TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at            TEXT,
  CHECK ((installment_plan_id IS NULL) = (installment_number IS NULL)),
  CHECK (installment_plan_id IS NULL OR amount_cents IS NOT NULL)
);
CREATE INDEX idx_expenses_charge_month ON expenses (charge_month) WHERE deleted_at IS NULL;
CREATE INDEX idx_expenses_subcategory ON expenses (subcategory_id);
CREATE INDEX idx_expenses_payment_method ON expenses (payment_method_id, charge_month);
CREATE INDEX idx_expenses_plan ON expenses (installment_plan_id, installment_number);
CREATE INDEX idx_expenses_deleted ON expenses (deleted_at) WHERE deleted_at IS NOT NULL;

-- Garantiza idempotencia: un recurrente se genera una sola vez por mes.
-- Si el gasto generado se borra, la fila queda (expense_id NULL) y no se regenera.
CREATE TABLE recurring_generations (
  template_id INTEGER NOT NULL REFERENCES recurring_templates (id) ON DELETE CASCADE,
  month       TEXT    NOT NULL CHECK (month GLOB '[0-9][0-9][0-9][0-9]-[01][0-9]'),
  expense_id  INTEGER REFERENCES expenses (id) ON DELETE SET NULL,
  PRIMARY KEY (template_id, month)
) WITHOUT ROWID;

CREATE TABLE incomes (
  id           INTEGER PRIMARY KEY,
  month        TEXT    NOT NULL CHECK (month GLOB '[0-9][0-9][0-9][0-9]-[01][0-9]'),
  type         TEXT    NOT NULL CHECK (type IN ('sueldo', 'aguinaldo', 'freelance', 'otro')),
  description  TEXT    NOT NULL DEFAULT '' CHECK (length(description) <= 200),
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  date         TEXT    NOT NULL CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[01][0-9]-[0-3][0-9]'),
  created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at   TEXT
);
CREATE INDEX idx_incomes_month ON incomes (month) WHERE deleted_at IS NULL;

CREATE TABLE savings_goals (
  id           INTEGER PRIMARY KEY,
  name         TEXT    NOT NULL COLLATE NOCASE CHECK (length(trim(name)) BETWEEN 1 AND 80),
  currency     TEXT    NOT NULL CHECK (currency IN ('ARS', 'USD')),
  target_minor INTEGER NOT NULL CHECK (target_minor > 0),
  target_date  TEXT    CHECK (target_date GLOB '[0-9][0-9][0-9][0-9]-[01][0-9]-[0-3][0-9]'),
  archived_at  TEXT,
  created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE savings_movements (
  id                 INTEGER PRIMARY KEY,
  date               TEXT    NOT NULL CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[01][0-9]-[0-3][0-9]'),
  month              TEXT    NOT NULL CHECK (month GLOB '[0-9][0-9][0-9][0-9]-[01][0-9]'),
  currency           TEXT    NOT NULL CHECK (currency IN ('ARS', 'USD')),
  -- positivo = aporte, negativo = retiro
  amount_minor       INTEGER NOT NULL CHECK (amount_minor <> 0),
  -- Sólo USD. Aporte: ARS que salieron para comprar. Retiro: ARS recibidos al vender.
  ars_cost_cents     INTEGER CHECK (ars_cost_cents >= 0),
  rate_cents_per_usd INTEGER CHECK (rate_cents_per_usd > 0),
  goal_id            INTEGER REFERENCES savings_goals (id) ON DELETE SET NULL,
  note               TEXT    NOT NULL DEFAULT '' CHECK (length(note) <= 200),
  created_at         TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at         TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at         TEXT,
  CHECK (currency = 'USD' OR (ars_cost_cents IS NULL AND rate_cents_per_usd IS NULL))
);
CREATE INDEX idx_savings_month ON savings_movements (month) WHERE deleted_at IS NULL;
CREATE INDEX idx_savings_goal ON savings_movements (goal_id);

CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
) WITHOUT ROWID;
