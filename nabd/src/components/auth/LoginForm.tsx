"use client";

/* Sign-in form — email + password against the server, with inline error
   state. Submits through the loginAction server action. */

import { useActionState } from "react";
import { loginAction } from "@/server/actions/authActions";
import { Icon } from "@/components/ui";

export function LoginForm({ labels }: {
  labels: { email: string; password: string; submit: string; error: string };
}) {
  const [state, formAction, pending] = useActionState(loginAction, { error: false });

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error && (
        <div
          className="rounded-xl px-4 py-3 text-sm font-semibold flex items-center gap-2"
          style={{ background: "var(--st-blocked-bg)", color: "var(--st-blocked)" }}
          role="alert"
        >
          <Icon name="alert-triangle" size={15} /> {labels.error}
        </div>
      )}
      <label className="block">
        <span className="block text-xs font-semibold text-ink-2 mb-1.5">{labels.email}</span>
        <input
          key={state.email ?? ""}
          name="email"
          type="email"
          required
          autoComplete="email"
          autoFocus
          defaultValue={state.email ?? ""}
          className="field-input"
          placeholder="omar.hassan@nabd.example"
        />
      </label>
      <label className="block">
        <span className="block text-xs font-semibold text-ink-2 mb-1.5">{labels.password}</span>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="field-input"
          placeholder="••••••••"
        />
      </label>
      <button type="submit" className="btn-primary justify-center !py-3 mt-1" disabled={pending}>
        <Icon name="log-in" size={16} /> {labels.submit}
      </button>
    </form>
  );
}
