import Link from 'next/link';
import { Logo } from '@/components/layout/Logo';
import { Github, Twitter } from 'lucide-react';

const FOOTER_LINKS = [
  { href: '/about', label: 'About' },
  { href: '/terms', label: 'Terms' },
  { href: '/privacy', label: 'Privacy' },
];

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border/60">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-6 py-10 sm:flex-row sm:justify-between">
        <div className="flex flex-col items-center gap-2 sm:items-start">
          <Logo size="sm" />
          <p className="text-xs text-muted-foreground">
            Pure chess. Nothing else.
          </p>
        </div>
        <nav aria-label="Footer" className="flex items-center gap-1">
          {FOOTER_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground hover:bg-raised"
            >
              {link.label}
            </Link>
          ))}
          <span className="mx-2 h-4 w-px bg-border/80" aria-hidden />
          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            className="rounded-md p-2 text-muted-foreground transition-colors hover:text-foreground hover:bg-raised"
            aria-label="GitHub"
          >
            <Github className="h-4 w-4" />
          </a>
          <a
            href="https://twitter.com"
            target="_blank"
            rel="noreferrer"
            className="rounded-md p-2 text-muted-foreground transition-colors hover:text-foreground hover:bg-raised"
            aria-label="Twitter"
          >
            <Twitter className="h-4 w-4" />
          </a>
        </nav>
        <p className="text-xs text-muted-foreground/80">
          © {new Date().getFullYear()} Purechess
        </p>
      </div>
    </footer>
  );
}
