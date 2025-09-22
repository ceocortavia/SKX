// Feature-flag controlled Wappalyzer integration
// Requires: npm i wappalyzer

export type TechInfo = {
  name: string;
  version: string | null;
  categories: string[];
};

export async function getTechStack(url: string): Promise<TechInfo[] | null> {
  if (process.env.ENABLE_TECH_STACK !== '1') return null;
  if (!url || !/^https?:\/\//i.test(url)) return null;

  try {
    const Wappalyzer = (await import('wappalyzer')).default as any;
    const options = { debug: false, delay: 250, maxDepth: 2, maxUrls: 8, recursive: true };
    const wappalyzer = new Wappalyzer(options);
    await wappalyzer.init();
    const site = await wappalyzer.open(url);
    const results = await site.analyze();
    await wappalyzer.destroy();

    const technologies: any[] = Array.isArray(results?.technologies) ? results.technologies : [];
    return technologies.map((t) => ({
      name: t?.name ?? 'Unknown',
      version: t?.version ?? null,
      categories: Array.isArray(t?.categories) ? t.categories.map((c: any) => c?.name).filter(Boolean) : [],
    }));
  } catch (e) {
    console.error('[techStack]', e);
    return null;
  }
}


