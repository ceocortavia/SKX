import { randomUUID } from 'node:crypto';
import { callProvider } from './provider';

export interface InviteCopyParams {
  orgDisplayName: string;
  role: string;
  language: 'nb' | 'en';
  tone: 'formal' | 'friendly';
  mission?: string | null;
}

export interface InviteVariant {
  id: string;
  subject: string;
  body: string;
}

export interface InviteGenerationResult {
  variants: InviteVariant[];
  tokensIn: number;
  tokensOut: number;
  model: string;
}

const schema = {
  type: 'object',
  required: ['variants'],
  properties: {
    variants: {
      type: 'array',
      minItems: 2,
      maxItems: 3,
      items: {
        type: 'object',
        required: ['subject', 'body'],
        properties: {
          subject: { type: 'string' },
          body: { type: 'string' }
        }
      }
    }
  }
};

function buildFallback(params: InviteCopyParams): InviteVariant[] {
  const { orgDisplayName, role, language, tone, mission } = params;
  const subjectFriendly = language === 'nb'
    ? `Du er invitert til ${orgDisplayName}`
    : `You're invited to ${orgDisplayName}`;
  const subjectFormal = language === 'nb'
    ? `Invitasjon: bli med i ${orgDisplayName}`
    : `Invitation: Join ${orgDisplayName}`;

  const intro = language === 'nb'
    ? `Hei!

Vi inviterer deg til å bli ${role} hos ${orgDisplayName}.`
    : `Hello!

We'd like to invite you to join ${orgDisplayName} as a ${role}.`;

  const toneLine = tone === 'friendly'
    ? language === 'nb'
      ? `Vi gleder oss til å jobbe sammen og håper du blir med oss.`
      : `We're excited about the chance to work together and hope you'll join us.`
    : language === 'nb'
      ? `Vi setter pris på om du bekrefter innen 7 dager.`
      : `We kindly ask that you confirm within 7 days.`;

  const missionLine = mission
    ? language === 'nb'
      ? `Vårt mål: ${mission}.`
      : `Our mission: ${mission}.`
    : '';

  const cta = language === 'nb'
    ? `Klikk på lenken i invitasjonen for å akseptere. Lenken utløper om 7 dager.`
    : `Use the link in this invitation to accept. The link expires in 7 days.`;

  const footer = language === 'nb'
    ? `Hilsen ${orgDisplayName}`
    : `Best regards, ${orgDisplayName}`;

  const baseBody = [intro, missionLine, toneLine, cta, footer]
    .filter(Boolean)
    .join('\n\n');

  const altToneLine = tone === 'friendly'
    ? language === 'nb'
      ? `Fortell oss gjerne hvis du har spørsmål – vi er her for å hjelpe.`
      : `Let us know if you have any questions—we're here to help.`
    : language === 'nb'
      ? `Ta kontakt om du trenger mer informasjon.`
      : `Please reach out if you need further information.`;

  const altBody = [intro, missionLine, altToneLine, cta, footer]
    .filter(Boolean)
    .join('\n\n');

  return [
    { id: randomUUID(), subject: tone === 'friendly' ? subjectFriendly : subjectFormal, body: baseBody },
    { id: randomUUID(), subject: tone === 'friendly' ? subjectFormal : subjectFriendly, body: altBody }
  ];
}

export async function generateInvitationCopy(params: InviteCopyParams): Promise<InviteGenerationResult> {
  const systemPrompt = params.language === 'nb'
    ? 'Du skriver invitasjoner på norsk (bokmål). Hold deg saklig, konkret og innenfor 1500 tokens.'
    : 'You write concise invitations in English. Stay within 1500 tokens and keep the tone on-brief.';

  const missionLine = params.mission ? `Mission: ${params.mission}` : 'Mission: (not provided)';

  const userPrompt = [
    `Organization: ${params.orgDisplayName}`,
    `Role: ${params.role}`,
    `Tone: ${params.tone}`,
    missionLine,
    'Return 2-3 variants with subject and body. Include CTA and mention the invitation expires in 7 days.'
  ].join('\n');

  const provider = await callProvider({
    systemPrompt,
    userPrompt,
    jsonSchema: { name: 'invitation_variants', schema },
    temperature: params.tone === 'friendly' ? 0.7 : 0.4,
  });

  if (provider) {
    try {
      const parsed = JSON.parse(provider.text ?? '{}');
      const variants = Array.isArray(parsed?.variants)
        ? parsed.variants
            .slice(0, 3)
            .map((item: any) => ({
              id: randomUUID(),
              subject: String(item?.subject ?? '').trim(),
              body: String(item?.body ?? '').trim(),
            }))
            .filter((v: InviteVariant) => v.subject && v.body)
        : [];

      if (variants.length >= 2) {
        return {
          variants,
          tokensIn: provider.tokensIn,
          tokensOut: provider.tokensOut,
          model: provider.model,
        };
      }
    } catch (err) {
      console.error('[ai.invite.parse]', err);
    }
  }

  const fallback = buildFallback(params);
  return {
    variants: fallback,
    tokensIn: provider?.tokensIn ?? 0,
    tokensOut: provider?.tokensOut ?? 0,
    model: provider?.model ?? 'fallback-local',
  };
}

