"""Excel mensuales de SEACE, con navegador visible y CAPTCHA manual.

El botón real no pudo verificarse desde desarrollo. Se reconoce por su nombre
Excel; si no hay un único candidato, el usuario lo pulsa o indica un selector.
"""
from __future__ import annotations
import argparse
import asyncio
import hashlib
import json
from pathlib import Path
import re
import tempfile
import unicodedata
from urllib.parse import urlencode
from zipfile import ZipFile, BadZipFile

BASE = 'https://prod2.seace.gob.pe/seacebus-uiwd-pub/buscadorPublico/ongei/buscadorPublicoOCOS.xhtml'
MESES = ('Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre')


def url_mes(anio: int, mes: int, ruc: str) -> str:
    if not 2000 <= anio <= 2100 or not 1 <= mes <= 12 or not re.fullmatch(r'\d{11}', ruc):
        raise ValueError('Año, mes o RUC inválido.')
    return BASE + '?' + urlencode({'ruc_entidad': ruc, 'anio': anio, 'mes': f'{mes:02d}', 'theme': 'ongei'})


def nombre_entidad(nombre: str) -> str:
    texto = unicodedata.normalize('NFKD', nombre).encode('ascii', 'ignore').decode()
    return re.sub(r'[^A-Za-z0-9]+', '-', texto).strip('-')[:80] or 'Municipalidad'


def extension_excel(archivo: Path) -> str:
    with archivo.open('rb') as entrada:
        firma = entrada.read(8)
    if firma == bytes.fromhex('d0cf11e0a1b11ae1'):
        return '.xls'
    if firma.startswith(b'PK'):
        try:
            with ZipFile(archivo) as libro:
                if 'xl/workbook.xml' in libro.namelist():
                    return '.xlsx'
        except BadZipFile:
            pass
    raise ValueError('La descarga no es un Excel .xls/.xlsx reconocido; no se registró como exitosa.')


def sha256(archivo: Path) -> str:
    resumen = hashlib.sha256()
    with archivo.open('rb') as entrada:
        for bloque in iter(lambda: entrada.read(1024 * 1024), b''):
            resumen.update(bloque)
    return resumen.hexdigest()


def descarga_verificada(fila: dict, carpeta: Path) -> bool:
    nombre = fila.get('archivo', '')
    if fila.get('estado') != 'descargado' or not isinstance(nombre, str) or Path(nombre).name != nombre:
        return False
    try:
        archivo = carpeta / nombre
        return extension_excel(archivo) in ('.xls', '.xlsx') and sha256(archivo) == fila.get('sha256')
    except (OSError, ValueError):
        return False


def guardar_resumen(ruta: Path, resumen: dict) -> None:
    with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=ruta.parent, suffix='.tmp', delete=False) as salida:
        json.dump(resumen, salida, ensure_ascii=False, indent=2)
        temporal = Path(salida.name)
    temporal.replace(ruta)


async def guardar_descarga(descarga, carpeta: Path, anio: int, mes: int, entidad: str) -> dict:
    with tempfile.TemporaryDirectory(dir=carpeta) as temporal:
        provisional = Path(temporal) / 'descarga'
        await descarga.save_as(str(provisional))
        extension = extension_excel(provisional)
        base = f'Ordenes-y-servicios-{anio}-{mes:02d}-{entidad}'
        destino = carpeta / (base + extension)
        numero = 2
        while destino.exists():
            destino = carpeta / f'{base}-{numero}{extension}'
            numero += 1
        with destino.open('xb') as salida, provisional.open('rb') as entrada:
            for bloque in iter(lambda: entrada.read(1024 * 1024), b''):
                salida.write(bloque)
        return {'estado': 'descargado', 'archivo': destino.name, 'nombre_original': descarga.suggested_filename,
                'sha256': sha256(destino), 'bytes': destino.stat().st_size}


async def descargar_mes(contexto, args, mes: int, carpeta: Path, entidad: str) -> dict:
    cola = asyncio.Queue()
    paginas = []
    def conectar(pagina):
        paginas.append(pagina)
        pagina.on('download', lambda descarga: cola.put_nowait(descarga))
    contexto.on('page', conectar)
    try:
        pagina = await contexto.new_page()
        respuesta = await pagina.goto(url_mes(args.anio, mes, args.ruc), wait_until='domcontentloaded', timeout=45_000)
        if respuesta is not None and respuesta.status >= 400:
            raise ValueError(f'SEACE respondió HTTP {respuesta.status}; no se intentará evadir el bloqueo.')
        await pagina.wait_for_timeout(1500)
        captcha = pagina.locator('input[name*="captcha" i], input[id*="captcha" i]')
        hay_captcha = any([await captcha.nth(i).is_visible() for i in range(await captcha.count())])
        if args.selector_excel:
            candidatos = pagina.locator(args.selector_excel)
        else:
            patron = re.compile(r'excel|\bxlsx?\b', re.I)
            candidatos = pagina.get_by_role('button', name=patron).or_(pagina.get_by_role('link', name=patron))
        visibles = [candidatos.nth(i) for i in range(await candidatos.count()) if await candidatos.nth(i).is_visible()]
        if len(visibles) == 1 and not hay_captcha and not args.manual:
            try:
                await visibles[0].click(timeout=10_000)
                descarga = await asyncio.wait_for(cola.get(), timeout=15)
                return await guardar_descarga(descarga, carpeta, args.anio, mes, entidad)
            except Exception as error:
                print(f'No se completó la descarga automática: {error}')
        print('Revisa el mes en el navegador. Si pide CAPTCHA, resuélvelo tú y pulsa Buscar.')
        print('Pulsa Exportar Excel en la página y después Enter aquí.')
        print('S = confirmar tú que ese mes no tiene registros; P = pendiente; Q = terminar.')
        opcion = (await asyncio.to_thread(input, 'Continuar: ')).strip().lower()
        if opcion == 'q':
            raise KeyboardInterrupt
        if opcion == 's':
            return {'estado': 'sin_registros_confirmado_por_usuario'}
        if opcion == 'p':
            return {'estado': 'pendiente', 'detalle': 'Mes dejado pendiente por el usuario.'}
        descarga = await asyncio.wait_for(cola.get(), timeout=15)
        return await guardar_descarga(descarga, carpeta, args.anio, mes, entidad)
    finally:
        contexto.remove_listener('page', conectar)
        for pagina in paginas:
            if not pagina.is_closed():
                await pagina.close()


async def ejecutar(args) -> int:
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        print('Instala Playwright: py -m pip install playwright==1.63.0')
        return 1
    entidad = nombre_entidad(args.municipio)
    carpeta = Path(args.salida).expanduser().resolve() / f'{entidad}-{args.ruc}' / str(args.anio)
    carpeta.mkdir(parents=True, exist_ok=True)
    ruta = carpeta / 'resumen-descargas.json'
    resumen = {'anio': args.anio, 'ruc': args.ruc, 'municipio': args.municipio, 'meses': {}}
    if ruta.exists():
        try:
            previo = json.loads(ruta.read_text(encoding='utf-8'))
            if previo.get('anio') == args.anio and previo.get('ruc') == args.ruc and isinstance(previo.get('meses'), dict):
                previo['meses'] = {k: v for k, v in previo['meses'].items() if k in {str(m) for m in range(1, 13)}}
                resumen = previo
        except (ValueError, AttributeError):
            print('Resumen anterior ilegible: se revisarán las descargas de nuevo.')
    print(f'Destino: {carpeta}\nNo se importarán datos al portal. Ctrl+C para terminar.')
    async with async_playwright() as playwright:
        opciones = {'headless': False}
        if args.navegador != 'chromium':
            opciones['channel'] = args.navegador
        navegador = await playwright.chromium.launch(**opciones)
        contexto = await navegador.new_context(accept_downloads=True)
        try:
            for mes in range(1, 13):
                clave = str(mes)
                fila = resumen['meses'].get(clave, {})
                if isinstance(fila, dict) and descarga_verificada(fila, carpeta):
                    print(f'{mes:02d} {MESES[mes - 1]}: ya descargado y verificado.')
                    continue
                print(f'\n{mes:02d} {MESES[mes - 1]} de {args.anio}')
                try:
                    fila = await descargar_mes(contexto, args, mes, carpeta, entidad)
                except KeyboardInterrupt:
                    print('Detenido. Repite el comando para continuar.')
                    break
                except Exception as error:
                    fila = {'estado': 'error', 'detalle': str(error)}
                    print(f'Pendiente de resolver: {error}')
                resumen['meses'][clave] = {**fila, 'url': url_mes(args.anio, mes, args.ruc)}
                guardar_resumen(ruta, resumen)
                if fila['estado'] == 'descargado':
                    print(f"Guardado: {fila['archivo']}")
                await asyncio.sleep(2)
        finally:
            await contexto.close()
            await navegador.close()
    guardar_resumen(ruta, resumen)
    filas = [fila for fila in resumen['meses'].values() if isinstance(fila, dict)]
    descargados = sum(descarga_verificada(fila, carpeta) for fila in filas)
    sin_registros = sum(fila.get('estado') == 'sin_registros_confirmado_por_usuario' for fila in filas)
    print(f'\nExcel verificados: {descargados}/12. Meses sin registros confirmados por ti: {sin_registros}.\nResumen: {ruta}')
    return 0 if descargados + sin_registros == 12 else 2


def main() -> int:
    parser = argparse.ArgumentParser(description='Descargar los doce Excel mensuales de SEACE por año.')
    parser.add_argument('--anio', type=int, help='Año; si se omite, se pregunta.')
    parser.add_argument('--ruc', default='20146657142')
    parser.add_argument('--municipio', default='Municipalidad Distrital de San Ramón')
    parser.add_argument('--salida', default='descargas-seace')
    parser.add_argument('--navegador', choices=['chrome', 'msedge', 'chromium'], default='chrome')
    parser.add_argument('--selector-excel', help='Selector CSS del botón real si no se identifica por su nombre Excel.')
    parser.add_argument('--manual', action='store_true', help='Pulsar Excel manualmente en cada mes.')
    args = parser.parse_args()
    if args.anio is None:
        try:
            args.anio = int(input('¿Qué año quieres descargar? (ejemplo: 2015): '))
        except ValueError:
            parser.error('Introduce un año numérico.')
    try:
        url_mes(args.anio, 1, args.ruc)
    except ValueError as error:
        parser.error(str(error))
    try:
        return asyncio.run(ejecutar(args))
    except KeyboardInterrupt:
        print('\nDetenido. Las descargas guardadas se conservan.')
        return 2
    except Exception as error:
        print(f'No se pudo iniciar/completar: {error}')
        print('Usa Chrome instalado, --navegador msedge o instala Chromium: py -m playwright install chromium')
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
