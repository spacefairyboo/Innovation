"use client";

/* Entry points for the AI check-in: chat and voice. */

import { useState } from "react";
import { useI18n } from "@/components/providers";
import { Icon } from "@/components/ui";
import { ChatModal } from "./ChatModal";
import type { Task } from "@/lib/types";

export function CheckinButtons({ tasks, userFirstName, doneThisWeek }: {
  tasks: Task[];
  userFirstName: string;
  doneThisWeek: number;
}) {
  const { t } = useI18n();
  const [mode, setMode] = useState<"closed" | "chat" | "voice">("closed");
  return (
    <>
      <button className="btn-soft" onClick={() => setMode("chat")}><Icon name="message-circle" size={16} /> {t("update_chat")}</button>
      <button className="btn-soft" onClick={() => setMode("voice")}><Icon name="mic" size={16} /> {t("update_voice")}</button>
      {mode !== "closed" && (
        <ChatModal
          tasks={tasks}
          userFirstName={userFirstName}
          doneThisWeek={doneThisWeek}
          startVoice={mode === "voice"}
          onClose={() => setMode("closed")}
        />
      )}
    </>
  );
}
