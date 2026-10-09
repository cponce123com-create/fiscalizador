'use server';

import { randomUUID } from 'crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requierePermiso } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';

const esquema = z.object({
  subjectKey: z.string().min(1).max(120),
  supplierId: z.string().min(1).max(80),
  reviewed: z.enum(['true', 'false']),
});

function texto(valor: FormDataEntryValue | null): string {
  return typeof valor === 'string' ? valor : '';
}

export async function accionMarcarRevisionComparador(formData: FormData) {
  const usuario = await requierePermiso('persons:write');
  const entrada = esquema.parse({
    subjectKey: texto(formData.get('subjectKey')),
    supplierId: texto(formData.get('supplierId')),
    reviewed: texto(formData.get('reviewed')),
  });
  const revisado = entrada.reviewed === 'true';
  await prisma.$executeRaw`
    INSERT INTO "ComparatorReview" ("id", "subjectKey", "supplierId", reviewed, "reviewedById", "reviewedAt", "updatedAt")
    VALUES (${randomUUID()}, ${entrada.subjectKey}, ${entrada.supplierId}, ${revisado}, ${usuario.id}, ${revisado ? new Date() : null}, now())
    ON CONFLICT ("subjectKey", "supplierId") DO UPDATE SET
      reviewed = EXCLUDED.reviewed,
      "reviewedById" = EXCLUDED."reviewedById",
      "reviewedAt" = EXCLUDED."reviewedAt",
      "updatedAt" = now()
  `;
  revalidatePath('/admin/comparador');
}
