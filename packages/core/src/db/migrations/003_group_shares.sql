-- 003: reparto de los gastos de grupo y pagos para saldar deudas entre las personas.

-- Quiénes participan de cada gasto de grupo. share_cents NULL = parte igual (se calcula con el monto,
-- así un gasto pendiente o con el monto corregido se reparte solo); con valor = monto a mano.
-- Un gasto usa todas partes iguales o todas a mano: lo verifica el service.
CREATE TABLE expense_shares (
  expense_id  INTEGER NOT NULL REFERENCES expenses (id) ON DELETE CASCADE,
  member_id   INTEGER NOT NULL REFERENCES group_members (id) ON DELETE RESTRICT,
  share_cents INTEGER CHECK (share_cents >= 0),
  PRIMARY KEY (expense_id, member_id)
) WITHOUT ROWID;
CREATE INDEX idx_expense_shares_member ON expense_shares (member_id);

-- Los gastos de grupo cargados antes de esta versión se reparten entre las personas activas.
INSERT INTO expense_shares (expense_id, member_id, share_cents)
SELECT e.id, m.id, NULL
FROM expenses e
JOIN group_members m ON m.group_id = e.group_id AND m.archived_at IS NULL
WHERE e.group_id IS NOT NULL;

-- "Ana le pasó $12.500 a Tobi": no es un gasto ni un ingreso, sólo mueve el saldo del grupo.
CREATE TABLE group_settlements (
  id             INTEGER PRIMARY KEY,
  group_id       INTEGER NOT NULL REFERENCES shared_groups (id) ON DELETE RESTRICT,
  from_member_id INTEGER NOT NULL REFERENCES group_members (id) ON DELETE RESTRICT,
  to_member_id   INTEGER NOT NULL REFERENCES group_members (id) ON DELETE RESTRICT,
  amount_cents   INTEGER NOT NULL CHECK (amount_cents > 0),
  date           TEXT    NOT NULL CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[01][0-9]-[0-3][0-9]'),
  note           TEXT    NOT NULL DEFAULT '' CHECK (length(note) <= 200),
  created_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at     TEXT,
  CHECK (from_member_id <> to_member_id)
);
CREATE INDEX idx_group_settlements_group ON group_settlements (group_id) WHERE deleted_at IS NULL;
