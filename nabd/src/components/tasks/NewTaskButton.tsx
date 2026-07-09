"use client";

import { useState } from "react";
import { useI18n } from "@/components/providers";
import { Icon } from "@/components/ui";
import { TaskModal } from "./TaskModal";
import type { AssigneeOption } from "./types";

export function NewTaskButton({ assignees }: { assignees?: AssigneeOption[] }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn-primary" onClick={() => setOpen(true)}><Icon name="plus" size={16} /> {t("add_task")}</button>
      {open && <TaskModal vm={null} assignees={assignees} onClose={() => setOpen(false)} />}
    </>
  );
}
