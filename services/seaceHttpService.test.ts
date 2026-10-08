import { readFile } from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { descargarExcelSeace, formularioExportacion } from './seaceHttpService';

function html(estado = '100:200', periodo = 'FEBRERO - 2018') {
  return `<form id="formBuscador" method="post" action="/seacebus-uiwd-pub/buscadorPublico/ongei/buscadorPublicoOCOS.xhtml"><span>${periodo}</span><input type="hidden" name="formBuscador" value="formBuscador"><button type="submit" name="formBuscador:btnExportar">Exportar a Excel xls</button><input type="hidden" name="formBuscador:hddIniciaBusqueda" value=""><input type="hidden" name="javax.faces.ViewState" value="${estado}"></form>`;
}
function pagina(estado = '100:200') {
  return new Response(html(estado), { headers: { 'Content-Type': 'text/html;charset=UTF-8', 'Set-Cookie': 'JSESSIONID=sesion-de-prueba; Path=/seacebus-uiwd-pub; HttpOnly' } });
}
describe('exportación JSF de SEACE mediante sesión propia', () => {
  const fetchMock = vi.fn();
  beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); });
  afterEach(() => vi.unstubAllGlobals());
  it('envía exactamente los cuatro campos con botón y búsqueda vacíos', () => {
    const form = formularioExportacion(html(), 2018, 2);
    expect(Object.fromEntries(form)).toEqual({ formBuscador: 'formBuscador', 'formBuscador:btnExportar': '', 'formBuscador:hddIniciaBusqueda': '', 'javax.faces.ViewState': '100:200' });
  });
  it('rechaza formulario inexistente, exportación ausente, estado vacío o periodo diferente', () => {
    for (const contenido of ['<html>CAPTCHA</html>', html().replace('formBuscador:btnExportar', 'otro'), html(''), html('100:200', 'DICIEMBRE - 2018'), html().replace('method="post"', 'method="get"'), html().replace('action="/seacebus', 'action="https://otro.test/seacebus')]) {
      expect(() => formularioExportacion(contenido, 2018, 2)).toThrow();
    }
  });
  it('hace GET y POST con estado/cookie propios y devuelve el original sin cambiar sus bytes', async () => {
    const bytes = await readFile('docs/reference/Lista-OCOS-2023-06.xls');
    fetchMock.mockResolvedValueOnce(pagina()).mockResolvedValueOnce(new Response(bytes, { headers: { 'Content-Type': 'application/vnd.ms-excel', 'Content-Disposition': 'attachment;filename=Lista-OCOS.xls' } }));
    const archivo = await descargarExcelSeace('admin', 2018, 2, '20146657142', 'Municipalidad Distrital de San Ramón');
    expect(archivo.bytes).toEqual(bytes);
    expect(archivo.filename).toBe('Ordenes-y-servicios-2018-02-Municipalidad-Distrital-de-San-Ramon.xls');
    expect(fetchMock.mock.calls[0][0]).toContain('anio=2018&mes=02');
    const [, opciones] = fetchMock.mock.calls[1];
    expect(opciones.method).toBe('POST');
    expect(opciones.headers.Cookie).toBe('JSESSIONID=sesion-de-prueba');
    expect(new URLSearchParams(opciones.body).get('javax.faces.ViewState')).toBe('100:200');
    expect(opciones.redirect).toBe('error');
    expect(opciones.headers.Referer).toContain('mes=02');
  });
  it('obtiene un estado nuevo al reintentar y no guarda la cookie del intento anterior', async () => {
    fetchMock.mockResolvedValueOnce(pagina('100:200')).mockResolvedValueOnce(new Response('<html>Error</html>', { headers: { 'Content-Type': 'text/html' } }));
    await expect(descargarExcelSeace('admin', 2018, 2, '20146657142', 'San Ramón')).rejects.toThrow(/no devolvió/);
    fetchMock.mockResolvedValueOnce(new Response(html('300:400'), { headers: { 'Content-Type': 'text/html' } })).mockResolvedValueOnce(new Response('falso', { headers: { 'Content-Type': 'application/vnd.ms-excel', 'Content-Disposition': 'attachment;filename=Lista-OCOS.xls' } }));
    await expect(descargarExcelSeace('admin', 2018, 2, '20146657142', 'San Ramón')).rejects.toThrow(/no es Excel/);
    expect(new URLSearchParams(fetchMock.mock.calls[3][1].body).get('javax.faces.ViewState')).toBe('300:400');
    expect(fetchMock.mock.calls[3][1].headers.Cookie).toBeUndefined();
  });
  it('detiene el proceso al recibir 403 antes de hacer POST y permite reintentar', async () => {
    fetchMock.mockResolvedValueOnce(new Response('Forbidden', { status: 403 }));
    await expect(descargarExcelSeace('admin', 2018, 2, '20146657142', 'San Ramón')).rejects.toThrow(/HTTP 403/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockResolvedValueOnce(new Response('Forbidden', { status: 403 }));
    await expect(descargarExcelSeace('admin', 2018, 2, '20146657142', 'San Ramón')).rejects.toThrow(/HTTP 403/);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it('rechaza archivos de más de 25 MB y no consulta años, RUC o meses inválidos', async () => {
    fetchMock.mockResolvedValueOnce(pagina()).mockResolvedValueOnce(new Response('x', { headers: { 'Content-Type': 'application/vnd.ms-excel', 'Content-Disposition': 'attachment;filename=Lista-OCOS.xls', 'Content-Length': String(26 * 1024 * 1024) } }));
    await expect(descargarExcelSeace('admin', 2018, 2, '20146657142', 'San Ramón')).rejects.toThrow(/tamaño/);
    fetchMock.mockClear();
    for (const mes of [0, 13]) await expect(descargarExcelSeace('admin', 2018, mes, '20146657142', 'San Ramón')).rejects.toThrow();
    await expect(descargarExcelSeace('admin', 2100, 2, '20146657142', 'San Ramón')).rejects.toThrow();
    await expect(descargarExcelSeace('admin', 2018, 2, '../otro', 'San Ramón')).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('rechaza una segunda descarga del mismo usuario mientras espera al servidor', async () => {
    let responder!: (r: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise<Response>(resolve => { responder = resolve; }));
    const primera = descargarExcelSeace('admin', 2018, 2, '20146657142', 'San Ramón');
    await expect(descargarExcelSeace('admin', 2018, 3, '20146657142', 'San Ramón')).rejects.toThrow(/en curso/);
    responder(new Response('Forbidden', { status: 403 }));
    await expect(primera).rejects.toThrow(/HTTP 403/);
  });
});
