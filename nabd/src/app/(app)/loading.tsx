/* Route-level loading state: the circular-soundwave pulse, centered where
   the page content will appear. */

import { PulseLoader } from "@/components/ui";

export default function Loading() {
  return (
    <div className="grid place-items-center py-28">
      <PulseLoader size={112} />
    </div>
  );
}
