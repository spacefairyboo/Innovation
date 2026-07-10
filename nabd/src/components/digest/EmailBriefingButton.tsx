"use client";

/* One-click "email me this briefing" — sends the current narrative digest
   to the signed-in user through the mail pipeline. */

import { useTransition } from "react";
import { emailMyBriefing } from "@/app/actions";
import { useI18n, useToast } from "@/components/providers";
import { Icon } from "@/components/ui";

export function EmailBriefingButton() {
  const { t } = useI18n();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  return (
    <button
      className="btn-ghost"
      disabled={pending}
      onClick={() => startTransition(async () => {
        await emailMyBriefing();
        toast(t("digest_sent"));
      })}
    >
      <Icon name="send" size={15} /> {t("digest_btn")}
    </button>
  );
}
