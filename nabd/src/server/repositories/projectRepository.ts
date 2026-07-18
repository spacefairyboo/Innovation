/* Project repository — named containers for related tasks. */

import { getDB } from "../db/connection";
import type { Project } from "@/lib/types";

/* eslint-disable @typescript-eslint/no-explicit-any */
const mapRow = (r: any): Project => ({
  id: r.id, name: r.name, createdBy: r.created_by ?? null, ts: Number(r.ts),
});
/* eslint-enable @typescript-eslint/no-explicit-any */

export const listProjects = (): Project[] =>
  (getDB().prepare("SELECT * FROM projects ORDER BY name COLLATE NOCASE").all() as Record<string, unknown>[]).map(mapRow);

export const getProject = (id: string): Project | null => {
  const r = getDB().prepare("SELECT * FROM projects WHERE id = ?").get(id);
  return r ? mapRow(r) : null;
};

export function createProject(name: string, createdBy: string): Project {
  // Same name twice returns the existing project instead of a duplicate.
  const existing = getDB().prepare("SELECT * FROM projects WHERE name = ? COLLATE NOCASE").get(name);
  if (existing) return mapRow(existing);
  const id = "p" + Math.random().toString(36).slice(2, 10);
  getDB().prepare("INSERT INTO projects (id, name, created_by, ts) VALUES (?,?,?,?)")
    .run(id, name, createdBy, Date.now());
  return getProject(id)!;
}
