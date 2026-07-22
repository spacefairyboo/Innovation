/* Unknown routes never show a 404 page: visitors land back on their own
   home (the middleware still routes signed-out visitors to /login). */

import { redirect } from "next/navigation";

export default function NotFound() {
  redirect("/");
}
