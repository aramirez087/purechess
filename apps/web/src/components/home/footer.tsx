import Link from 'next/link';
import { Logo } from '@/components/layout/Logo';

export function Footer() {
  return (
    <footer className="border-t border-border mt-auto py-6 px-6">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
        <Logo className="text-foreground font-semibold" />
        <nav aria-label="Footer">
          <ul className="flex gap-6 list-none">
            <li>
              <Link href="/about" className="hover:text-foreground transition-colors">
                About
              </Link>
            </li>
            <li>
              <Link href="/terms" className="hover:text-foreground transition-colors">
                Terms
              </Link>
            </li>
            <li>
              <Link href="/privacy" className="hover:text-foreground transition-colors">
                Privacy
              </Link>
            </li>
          </ul>
        </nav>
        <p>© {new Date().getFullYear()} Purechess</p>
      </div>
    </footer>
  );
}
