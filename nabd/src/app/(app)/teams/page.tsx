/* The former PCA Overview page is retired: the home dashboard carries the
   section/unit drill-down now. Anything still pointing here lands home. */

import { redirect } from "next/navigation";

export default function TeamsGone() {
  redirect("/");
}
