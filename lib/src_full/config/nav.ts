export const navItems = [
  { label: "Hjem", href: "/" },
  { label: "Tjenester", href: "#services" },
  { label: "Om oss", href: "#about" },
  { label: "Kontakt", href: "#contact" },
  { label: "Dashboard", href: "/dashboard" },
] as const;

export type NavItem = (typeof navItems)[number];


