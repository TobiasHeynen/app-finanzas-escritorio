-- 002: grupos (pareja, amigos, un viaje) con personas que son sólo nombres, y "quién pagó" en los gastos.
-- La tabla no se llama "groups" porque GROUPS es palabra clave de SQLite.

CREATE TABLE shared_groups (
  id          INTEGER PRIMARY KEY,
  name        TEXT    NOT NULL COLLATE NOCASE UNIQUE CHECK (length(trim(name)) BETWEEN 1 AND 60),
  sort_order  INTEGER NOT NULL DEFAULT 0,
  archived_at TEXT,
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE group_members (
  id          INTEGER PRIMARY KEY,
  group_id    INTEGER NOT NULL REFERENCES shared_groups (id) ON DELETE RESTRICT,
  name        TEXT    NOT NULL COLLATE NOCASE CHECK (length(trim(name)) BETWEEN 1 AND 40),
  sort_order  INTEGER NOT NULL DEFAULT 0,
  -- Una persona que se saca del grupo queda archivada: sus gastos siguen diciendo que pagó ella.
  archived_at TEXT,
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (group_id, name)
);
CREATE INDEX idx_group_members_group ON group_members (group_id);

-- Grupo y quién pagó van los dos o ninguno, y la persona tiene que ser del grupo: lo verifica el service.
ALTER TABLE expenses ADD COLUMN group_id INTEGER REFERENCES shared_groups (id) ON DELETE RESTRICT;
ALTER TABLE expenses ADD COLUMN paid_by_member_id INTEGER REFERENCES group_members (id) ON DELETE RESTRICT;
CREATE INDEX idx_expenses_group ON expenses (group_id) WHERE group_id IS NOT NULL;

-- Las cuotas y los recurrentes guardan el grupo para copiarlo a cada gasto que generan.
ALTER TABLE installment_plans ADD COLUMN group_id INTEGER REFERENCES shared_groups (id) ON DELETE RESTRICT;
ALTER TABLE installment_plans ADD COLUMN paid_by_member_id INTEGER REFERENCES group_members (id) ON DELETE RESTRICT;
ALTER TABLE recurring_templates ADD COLUMN group_id INTEGER REFERENCES shared_groups (id) ON DELETE RESTRICT;
ALTER TABLE recurring_templates ADD COLUMN paid_by_member_id INTEGER REFERENCES group_members (id) ON DELETE RESTRICT;
