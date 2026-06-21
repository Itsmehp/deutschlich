import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";

export function Navbar() {
  return (
    <nav className="border-b bg-background">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
        <Link href="/dashboard" className="font-bold text-xl tracking-tight">
          Deutschlich 🇩🇪
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/study" className="text-sm font-medium hover:text-primary">Study</Link>
          <Link href="/words" className="text-sm font-medium hover:text-primary">Words</Link>
          <Link href="/categories" className="text-sm font-medium hover:text-primary">Categories</Link>
          <Link href="/dashboard" className="text-sm font-medium hover:text-primary">Dashboard</Link>
          <Link href="/settings" className="text-sm font-medium hover:text-primary">Settings</Link>
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
}
