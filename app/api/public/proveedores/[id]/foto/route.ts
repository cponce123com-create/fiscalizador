import { prisma } from '@/lib/prisma';
import { leerFotoPrivada } from '@/services/privatePhotoStorage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const perfil = await prisma.supplierProfile.findUnique({ where: { supplierId: id }, select: { photoKey: true, photoMime: true } });
  if (!perfil?.photoKey) return new Response(null, { status: 404 });
  try {
    const imagen = await leerFotoPrivada(perfil.photoKey);
    return new Response(new Uint8Array(imagen), { headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': 'inline' } });
  } catch { return new Response(null, { status: 404 }); }
}
