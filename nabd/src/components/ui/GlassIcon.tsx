import { Icon } from "./Icon";

/* A big frosted icon medallion: gradient tint over glass, a soft colored
   glow, and an inner highlight. The hero mark for feature cards (Tools,
   uploaders, empty states). */

export function GlassIcon({ name, size = 64, icon = 28, tint = "var(--primary)" }: {
  name: string;
  size?: number;
  icon?: number;
  tint?: string;
}) {
  return (
    <span
      className="grid place-items-center shrink-0 rounded-2xl border"
      style={{
        width: size,
        height: size,
        color: tint,
        background: `linear-gradient(135deg, color-mix(in srgb, ${tint} 22%, transparent), color-mix(in srgb, var(--surface) 60%, transparent))`,
        borderColor: "var(--glass-edge)",
        backdropFilter: "blur(14px)",
        boxShadow: `0 10px 26px color-mix(in srgb, ${tint} 26%, transparent), inset 0 1px 0 rgb(255 255 255 / 0.35)`,
      }}
      aria-hidden
    >
      <Icon name={name} size={icon} />
    </span>
  );
}
