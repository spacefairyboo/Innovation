import type { Metadata } from "next";
import "./globals.css";
import { getSession } from "@/server/auth/session";

export const metadata: Metadata = {
  title: "Nabd — Team Pulse",
  description: "Bilingual task-pulse platform: track, chat, speak, and listen to your team's progress.",
};

/* Root layout: document shell only. The authenticated experience lives in
   the (app) route group; /login renders standalone. */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { lang, theme } = await getSession();
  return (
    <html lang={lang} dir={lang === "ar" ? "rtl" : "ltr"} data-theme={theme}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
