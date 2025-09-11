type HeroProps = {
  title?: string;
  html: string;
};

export default function Hero({ title, html }: HeroProps) {
  return (
    <section id="intro" className="mx-auto max-w-6xl px-4 py-12">
      {title ? <h1 className="text-3xl md:text-5xl font-bold mb-4">{title}</h1> : null}
      <div className="prose prose-zinc max-w-none" dangerouslySetInnerHTML={{ __html: html }} />
    </section>
  );
}

