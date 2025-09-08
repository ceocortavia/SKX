"use client";

import { useRouter } from "next/navigation";
import React from "react";

type Props = { html: string; className?: string };

export default function MarkdownHTML({ html, className }: Props) {
  const router = useRouter();

  const onClick: React.MouseEventHandler<HTMLDivElement> = (e) => {
    const target = e.target as HTMLElement;
    if (!target) return;

    const anchor = target.closest("a") as HTMLAnchorElement | null;
    if (!anchor) return;

    const href = anchor.getAttribute("href");
    if (!href) return;

    const isInternal = href.startsWith("/") || href.startsWith("./") || href.startsWith("../");
    if (isInternal) {
      e.preventDefault();
      router.push(href);
    }
  };

  return <div className={className} onClick={onClick} dangerouslySetInnerHTML={{ __html: html }} />;
}



