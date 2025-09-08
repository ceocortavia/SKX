import "server-only";
import Topbar from "@/components/marketing/Topbar";
import { readMarkdownHtml } from "@/lib/markdown";

export const revalidate = 60;

export default async function DocsPage() {
  const html = await readMarkdownHtml("docs/design.md");
  return (
    <>
      <Topbar />
      <main className="max-w-4xl mx-auto px-4 md:px-6 py-10 prose prose-slate prose-headings:scroll-mt-24">
        {/* eslint-disable-next-line react/no-danger */}
        <div dangerouslySetInnerHTML={{ __html: html }} />
      </main>
    </>
  );
}


