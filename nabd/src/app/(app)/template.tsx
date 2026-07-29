/* Every navigation re-mounts this wrapper, so each page rises into place. */

export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
