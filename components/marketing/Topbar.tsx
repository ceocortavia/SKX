import NavMenu from "./NavMenu";
import type { NavItem } from "./NavMenu";

export default function Topbar({ items }: { items: NavItem[] }) {
  return (
    <header className="w-full border-b">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
        <a href="/" className="font-semibold">SKX</a>
        <NavMenu items={items} />
      </div>
    </header>
  );
}

