import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const BRREG_OPEN_BASE = 'https://data.brreg.no/enhetsregisteret/api';

type FetchJsonResult = { ok: boolean; status: number; ms: number; json: any };

async function fetchJSON(url: string, init: RequestInit = {}, timeoutMs = 7000): Promise<FetchJsonResult> {
  const controller = new AbortController();
  const startedAt = Date.now();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal, cache: 'no-store' });
    const text = await res.text();
    let json: any;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { _raw: text?.slice(0, 500) };
    }
    return { ok: res.ok, status: res.status, ms: Date.now() - startedAt, json };
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const orgnr = (searchParams.get('orgnr') || '').trim();
    if (!/^\d{9}$/.test(orgnr)) {
      return NextResponse.json({ ok: false, error: 'invalid_orgnr', hint: 'Bruk 9 siffer', orgnr }, { status: 400 });
    }

    const url = `${BRREG_OPEN_BASE}/enheter/${orgnr}`;
    const r = await fetchJSON(url, { headers: { accept: 'application/json' } });

    let bodyPreview: string;
    try {
      bodyPreview = typeof r.json === 'string' ? r.json.slice(0, 400) : JSON.stringify(r.json).slice(0, 400);
    } catch {
      bodyPreview = '[unserializable]';
    }

    return NextResponse.json({
      ok: r.ok,
      status: r.status,
      ms: r.ms,
      url,
      mode: process.env.BRREG_MODE || 'open',
      bodyPreview,
      ts: new Date().toISOString()
    }, { status: r.ok ? 200 : (r.status || 500) });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'diag_exception', message: e?.message || String(e) }, { status: 500 });
  }
}



