import { expect, test } from '@playwright/test';

test.describe('portal público', () => {
  test('carga la portada y sus controles principales', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /busca a una persona o empresa/i })).toBeVisible();
    await expect(page.getByRole('searchbox', { name: /buscar en todas las municipalidades/i })).toBeVisible();
    await expect(page.getByText(/explorar por entidad/i)).toBeVisible();
  });

  test('la búsqueda global cancela estados anteriores y presenta una respuesta', async ({ page }) => {
    await page.goto('/');
    const buscador = page.getByRole('searchbox', { name: /buscar en todas las municipalidades/i });
    await buscador.fill(process.env.E2E_SEARCH_TERM ?? 'galarza');
    await expect(page.getByRole('status')).not.toContainText(/escribe al menos 3/i);
    await expect(page.getByRole('status')).toContainText(/coincidente|sin coincidencias/i, { timeout: 15_000 });
  });

  test('las rutas administrativas no quedan públicas', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/login|\/admin/);
    await expect(page.getByText(/iniciar sesión|acceso|autentic/i).first()).toBeVisible();
  });

  test('un perfil conocido conserva la municipalidad seleccionada', async ({ page }) => {
    const slug = process.env.E2E_SUPPLIER_SLUG;
    test.skip(!slug, 'Define E2E_SUPPLIER_SLUG para validar un proveedor de la base E2E.');
    const municipalidad = process.env.E2E_MUNICIPALITY_SLUG ?? 'oxapampa';
    await page.goto(`/proveedores/${slug}?municipalidad=${municipalidad}`);
    await expect(page).toHaveURL(new RegExp(`municipalidad=${municipalidad}`));
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText(/órdenes registradas/i)).toBeVisible();
  });
});

