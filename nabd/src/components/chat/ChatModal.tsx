"use client";

/* AI check-in modal — a thin dialog around the shared check-in panel. */

import { useI18n } from "@/components/providers";
import { Modal } from "@/components/ui";
import { CheckinPanel } from "./CheckinPanel";
import type { Task } from "@/lib/types";

export function ChatModal({ tasks, userFirstName, doneThisWeek, startVoice, onClose }: {
  tasks: Task[];
  userFirstName: string;
  doneThisWeek: number;
  startVoice: boolean;
  onClose: () => void;
}) {
  const { t } = useI18n();
  return (
    <Modal title={t("chat_title")} icon="message-circle" onClose={onClose}>
      <CheckinPanel
        tasks={tasks}
        userFirstName={userFirstName}
        doneThisWeek={doneThisWeek}
        startVoice={startVoice}
        autoFocus={!startVoice}
      />
    </Modal>
  );
}
