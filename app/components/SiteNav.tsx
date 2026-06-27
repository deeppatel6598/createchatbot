import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";

/**
 * Shared top navigation. With a `slug` it renders a clinic's nav (links scoped to
 * /c/<slug>); without one it renders the platform marketing nav. Theme-aware.
 */
export function SiteNav({
  slug,
  brandName,
  emoji,
}: {
  slug?: string;
  brandName?: string;
  emoji?: string;
}) {
  const home = slug ? `/c/${slug}` : "/";
  const links = slug
    ? [
        { href: `/c/${slug}`, label: "Home" },
        { href: `/c/${slug}/about`, label: "About" },
        { href: `/c/${slug}/contact`, label: "Contact" },
        { href: `/c/${slug}/admin`, label: "Dashboard" },
      ]
    : [
        { href: "/", label: "Home" },
        { href: "/about", label: "About" },
        { href: "/contact", label: "Contact" },
        { href: "/operator", label: "Operator" },
      ];

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
        <Link href={home} className="flex items-center gap-2 font-semibold text-foreground">
          <span aria-hidden="true">{emoji ?? "🐾"}</span>
          <span>{brandName ?? "Sofia Concierge"}</span>
        </Link>
        <div className="flex items-center gap-1 sm:gap-2">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-lg px-2.5 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              {l.label}
            </Link>
          ))}
          <ThemeToggle className="ml-1" />
        </div>
      </nav>
    </header>
  );
}
