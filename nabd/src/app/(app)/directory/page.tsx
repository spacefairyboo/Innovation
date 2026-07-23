/* Employee directory — everyone in the department with their names in both
   languages, job title, section, unit, phone extension, and email, plus
   headcount tiles filtered together with the table. */

import { DirectoryTable, type DirectoryRow } from "@/components/directory";
import { makeT } from "@/lib/i18n";
import { listTeams, listUnits, listUsers } from "@/server/repositories";
import { getSession } from "@/server/auth/session";

export default async function DirectoryPage() {
  const { lang } = await getSession();
  const t = makeT(lang);

  const teams = new Map(listTeams().map((tm) => [tm.id, tm]));
  const sections = listUnits();
  const sectionById = new Map(sections.map((u) => [u.id, u]));

  const rows: DirectoryRow[] = listUsers().map((u) => {
    const team = u.teamId ? teams.get(u.teamId) : undefined;
    const sectionId = team?.unitId ?? u.sectionId ?? null;
    return {
      id: u.id,
      name: u.name,
      role: u.role,
      title: { en: makeT("en")(`role_${u.role}`), ar: makeT("ar")(`role_${u.role}`) },
      sectionId,
      section: sectionId ? (sectionById.get(sectionId)?.name ?? null) : null,
      unit: team?.name ?? null,
      ext: u.phoneExt,
      email: u.email,
    };
  }).sort((a, b) => a.name.en.localeCompare(b.name.en));

  return (
    <>
      <div className="mb-5">
        <h2 className="m-0 text-xl font-bold">{t("nav_directory")}</h2>
        <p className="m-0 mt-0.5 text-sm text-ink-2">{t("dir_sub")}</p>
      </div>
      <DirectoryTable rows={rows} sections={sections.map((u) => ({ id: u.id, name: u.name }))} />
    </>
  );
}
