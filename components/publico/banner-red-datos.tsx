'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, PointerEvent } from 'react';
import { Building2, FileSpreadsheet, Files, Landmark, Network, Pause, Play, RotateCcw, UserRound, UsersRound, Vote } from 'lucide-react';
import styles from './banner-red-datos.module.css';

type Punto = { x: number; y: number };
const nodos = [
  { id: 'libros', icono: FileSpreadsheet, titulo: 'Libros municipales', detalle: 'La información comienza en los documentos publicados.', color: '#9fcbbd', escritorio: [100, 130], movil: [90, 110] },
  { id: 'ordenes', icono: Files, titulo: 'Órdenes de compra y servicio', detalle: 'Cada registro conserva su fuente y periodo.', color: '#9fcbbd', escritorio: [125, 325], movil: [70, 275] },
  { id: 'motor', icono: Network, titulo: 'Fiscalizador', detalle: 'Organiza y cruza órdenes, proveedores, entidades y periodos.', color: '#76ffe0', escritorio: [360, 220], movil: [235, 235] },
  { id: 'persona', icono: UserRound, titulo: 'Proveedores · personas', detalle: 'Una persona puede contratar con varias municipalidades.', color: '#65e9dc', escritorio: [590, 125], movil: [230, 100] },
  { id: 'empresa', icono: Building2, titulo: 'Proveedores · empresas', detalle: 'Sus órdenes se agrupan por entidad y periodo.', color: '#65e9dc', escritorio: [620, 315], movil: [320, 390] },
  { id: 'muni1', icono: Landmark, titulo: 'Municipalidad A', detalle: 'Cada municipalidad conserva sus propios datos.', color: '#a1f2af', escritorio: [865, 90], movil: [390, 140] },
  { id: 'muni2', icono: Landmark, titulo: 'Municipalidad B', detalle: 'Los proveedores se pueden comparar entre entidades.', color: '#a1f2af', escritorio: [905, 230], movil: [395, 270] },
  { id: 'muni3', icono: Landmark, titulo: 'Municipalidad C', detalle: 'Las órdenes mantienen su procedencia municipal.', color: '#a1f2af', escritorio: [865, 375], movil: [395, 475] },
  { id: 'electoral', icono: Vote, titulo: 'Participación electoral', detalle: 'Los perfiles reúnen candidaturas y periodos registrados.', color: '#efc486', escritorio: [355, 385], movil: [90, 430] },
  { id: 'vinculos', icono: UsersRound, titulo: 'Vínculos documentados', detalle: 'Los vínculos requieren fuentes; los apellidos solos no los acreditan.', color: '#efc486', escritorio: [575, 425], movil: [220, 465] },
] as const;

const enlaces = [
  { de: 'libros', a: 'motor', curva: 22 }, { de: 'ordenes', a: 'motor', curva: -25 },
  { de: 'motor', a: 'persona', curva: -20 }, { de: 'motor', a: 'empresa', curva: 20 },
  { de: 'persona', a: 'muni1', curva: -12 }, { de: 'persona', a: 'muni2', curva: 25 },
  { de: 'empresa', a: 'muni2', curva: -15 }, { de: 'empresa', a: 'muni3', curva: 18 },
  { de: 'electoral', a: 'motor', curva: -25 }, { de: 'vinculos', a: 'persona', curva: -65 },
  { de: 'electoral', a: 'vinculos', curva: 15 },
];

type Curva = { inicio: Punto; control: Punto; fin: Punto; d: string };
function crearCurva(inicio: Punto, fin: Punto, arco: number): Curva {
  const dx = fin.x - inicio.x, dy = fin.y - inicio.y;
  const distancia = Math.max(1, Math.hypot(dx, dy));
  const control = { x: (inicio.x + fin.x) / 2 - dy / distancia * arco, y: (inicio.y + fin.y) / 2 + dx / distancia * arco };
  return { inicio, control, fin, d: `M ${inicio.x} ${inicio.y} Q ${control.x} ${control.y} ${fin.x} ${fin.y}` };
}
function puntoEnCurva({ inicio, control, fin }: Curva, t: number): Punto {
  const s = 1 - t;
  return { x: s * s * inicio.x + 2 * s * t * control.x + t * t * fin.x, y: s * s * inicio.y + 2 * s * t * control.y + t * t * fin.y };
}

/** Escena conceptual: no consulta APIs ni presenta relaciones personales reales. */
export function BannerRedDatos() {
  const descripcionId = useId();
  const escena = useRef<HTMLDivElement>(null);
  const [compacto, setCompacto] = useState(false);
  const [posiciones, setPosiciones] = useState<Record<string, Punto>>({});
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const [pausado, setPausado] = useState(false);
  const [visible, setVisible] = useState(false);
  const [paginaVisible, setPaginaVisible] = useState(true);
  const [movimientoReducido, setMovimientoReducido] = useState(true);
  const arrastre = useRef<{ id: string; pointerId: number; dx: number; dy: number } | null>(null);
  const movimientoPendiente = useRef<{ id: string; punto: Punto } | null>(null);
  const frameMovimiento = useRef<number | null>(null);
  const cabezas = useRef<(SVGGElement | null)[]>([]);
  const estelas = useRef<(SVGPathElement | null)[]>([]);
  const curvasActuales = useRef<Curva[]>([]);
  const reloj = useRef(0);
  const ancho = compacto ? 480 : 1000, alto = compacto ? 540 : 480;
  const activo = sobre ?? seleccionado;
  const animando = visible && paginaVisible && !pausado && !movimientoReducido;
  const puntos = useMemo(() => Object.fromEntries(nodos.map(n => {
    const [x, y] = compacto ? n.movil : n.escritorio;
    return [n.id, posiciones[n.id] ?? { x, y }];
  })), [compacto, posiciones]);
  const curvas = useMemo(() => enlaces.map(e => crearCurva(puntos[e.de], puntos[e.a], e.curva)), [puntos]);
  const relacionados = new Set([activo]);
  enlaces.forEach(e => { if (e.de === activo || e.a === activo) { relacionados.add(e.de); relacionados.add(e.a); } });
  const detalle = nodos.find(n => n.id === activo);

  const pintarPulsos = useCallback((tiempo: number) => {
    curvasActuales.current.forEach((curva, i) => {
      const t = (tiempo / (3500 + i % 4 * 550) + i * .173) % 1;
      const p = puntoEnCurva(curva, t);
      cabezas.current[i]?.setAttribute('transform', `translate(${p.x} ${p.y})`);
      const tramo = Array.from({ length: 6 }, (_, k) => puntoEnCurva(curva, Math.max(0, t - .12 + k * .024)));
      estelas.current[i]?.setAttribute('d', tramo.map((v, k) => `${k ? 'L' : 'M'} ${v.x} ${v.y}`).join(' '));
    });
  }, []);

  useEffect(() => {
    curvasActuales.current = curvas;
    pintarPulsos(reloj.current);
  }, [curvas, pintarPulsos]);

  useEffect(() => {
    const elemento = escena.current;
    if (!elemento) return;
    let eraCompacto = false;
    const resize = new ResizeObserver(([entry]) => {
      const siguiente = entry.contentRect.width <= 640;
      if (siguiente !== eraCompacto) {
        eraCompacto = siguiente; setCompacto(siguiente); setPosiciones({});
        arrastre.current = null; movimientoPendiente.current = null; setArrastrando(null);
      }
    });
    const interseccion = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0 });
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const cambiarMovimiento = () => setMovimientoReducido(media.matches);
    const cambiarVisibilidad = () => setPaginaVisible(!document.hidden);
    cambiarMovimiento(); cambiarVisibilidad();
    resize.observe(elemento); interseccion.observe(elemento);
    media.addEventListener('change', cambiarMovimiento);
    document.addEventListener('visibilitychange', cambiarVisibilidad);
    return () => {
      resize.disconnect(); interseccion.disconnect();
      media.removeEventListener('change', cambiarMovimiento);
      document.removeEventListener('visibilitychange', cambiarVisibilidad);
      if (frameMovimiento.current !== null) cancelAnimationFrame(frameMovimiento.current);
    };
  }, []);

  useEffect(() => {
    if (!animando) return;
    let frame: number, anterior = performance.now();
    const avanzar = (ahora: number) => {
      const delta = ahora - anterior;
      // 30 fps bastan para el flujo ambiental; no hay renders React por fotograma.
      if (delta >= 1000 / 30) {
        reloj.current += Math.min(delta, 100); anterior = ahora; pintarPulsos(reloj.current);
      }
      frame = requestAnimationFrame(avanzar);
    };
    frame = requestAnimationFrame(avanzar);
    return () => cancelAnimationFrame(frame);
  }, [animando, pintarPulsos]);

  function coordenadas(event: PointerEvent<HTMLButtonElement>): Punto {
    const rect = escena.current!.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * ancho / rect.width, y: (event.clientY - rect.top) * alto / rect.height };
  }
  function limitar(p: Punto): Punto {
    const rect = escena.current?.getBoundingClientRect();
    const margenX = rect ? 48 * ancho / rect.width : 55;
    const margenY = rect ? 48 * alto / rect.height : 55;
    return { x: Math.max(margenX, Math.min(ancho - margenX, p.x)), y: Math.max(margenY, Math.min(alto - margenY, p.y)) };
  }
  function aplicarMovimiento() {
    const pendiente = movimientoPendiente.current;
    if (pendiente) setPosiciones(prev => ({ ...prev, [pendiente.id]: pendiente.punto }));
    movimientoPendiente.current = null; frameMovimiento.current = null;
  }
  function iniciar(event: PointerEvent<HTMLButtonElement>, id: string) {
    if (!event.isPrimary || event.button !== 0 || arrastre.current) return;
    event.preventDefault(); event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    const p = coordenadas(event);
    arrastre.current = { id, pointerId: event.pointerId, dx: p.x - puntos[id].x, dy: p.y - puntos[id].y };
    setSeleccionado(id); setArrastrando(id);
  }
  function mover(event: PointerEvent<HTMLButtonElement>) {
    const drag = arrastre.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const p = coordenadas(event);
    movimientoPendiente.current = { id: drag.id, punto: limitar({ x: p.x - drag.dx, y: p.y - drag.dy }) };
    if (frameMovimiento.current === null) frameMovimiento.current = requestAnimationFrame(aplicarMovimiento);
  }
  function terminar(event: PointerEvent<HTMLButtonElement>) {
    if (arrastre.current?.pointerId !== event.pointerId) return;
    if (frameMovimiento.current !== null) cancelAnimationFrame(frameMovimiento.current);
    aplicarMovimiento(); arrastre.current = null; setArrastrando(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function teclado(event: KeyboardEvent<HTMLButtonElement>, id: string) {
    if (event.key === 'Escape') { setSeleccionado(null); setSobre(null); return; }
    const direcciones: Record<string, Punto> = { ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 }, ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 } };
    const direccion = direcciones[event.key];
    if (!direccion) return;
    event.preventDefault();
    const paso = event.shiftKey ? 24 : 10;
    setPosiciones(prev => ({ ...prev, [id]: limitar({ x: puntos[id].x + direccion.x * paso, y: puntos[id].y + direccion.y * paso }) }));
    setSeleccionado(id);
  }
  function restablecer() {
    if (frameMovimiento.current !== null) cancelAnimationFrame(frameMovimiento.current);
    frameMovimiento.current = null; movimientoPendiente.current = null; arrastre.current = null;
    setPosiciones({}); setSeleccionado(null); setSobre(null); setArrastrando(null);
  }

  return (
    <section aria-label="Red interactiva de Fiscalizador" aria-describedby={descripcionId} className={styles.banner}>
      <p id={descripcionId} className={styles.srOnly}>Ilustración conceptual del cruce de información, sin datos en vivo. Arrastra los nodos o usa las flechas del teclado para moverlos. Toca un nodo para explorar sus conexiones.</p>
      <div ref={escena} className={styles.escena} data-running={animando} onPointerDown={event => {
        if (event.target === event.currentTarget) { setSeleccionado(null); setSobre(null); }
      }}>
        <div className={styles.rejilla} aria-hidden="true" />
        <svg className={styles.red} viewBox={`0 0 ${ancho} ${alto}`} preserveAspectRatio="none" aria-hidden="true">
          {enlaces.map((e, i) => {
            const destacado = !activo || e.de === activo || e.a === activo;
            const color = e.de === 'electoral' || e.de === 'vinculos' ? '#efc486' : '#67f9d3';
            return <g key={`${e.de}-${e.a}`} className={styles.conexion} data-atenuado={!destacado} style={{ color }}>
              <path d={curvas[i].d} className={styles.carril} data-edge={`${e.de}-${e.a}`} />
              <path ref={el => { estelas.current[i] = el; }} className={styles.estela} />
              <g ref={el => { cabezas.current[i] = el; }} className={styles.pulso} transform={`translate(${curvas[i].inicio.x} ${curvas[i].inicio.y})`}>
                <circle r="12" fill="currentColor" opacity=".10" /><circle r="7" fill="currentColor" opacity=".23" /><circle r="3.5" fill="#effff9" />
              </g>
            </g>;
          })}
        </svg>
        {nodos.map(({ id, icono: Icono, titulo, color }) => <button
          key={id} type="button" data-node={id} aria-label={titulo} aria-pressed={seleccionado === id}
          className={`${styles.nodo} ${id === 'motor' ? styles.motor : ''}`}
          style={{ left: `${puntos[id].x / ancho * 100}%`, top: `${puntos[id].y / alto * 100}%`, '--acento': color } as CSSProperties}
          data-activo={activo === id} data-atenuado={!!activo && !relacionados.has(id)} data-arrastrando={arrastrando === id}
          onPointerDown={event => iniciar(event, id)} onPointerMove={mover} onPointerUp={terminar} onPointerCancel={terminar} onLostPointerCapture={terminar}
          onPointerEnter={event => { if (event.pointerType === 'mouse' && !arrastre.current) setSobre(id); }}
          onPointerLeave={() => setSobre(null)} onFocus={() => setSobre(id)} onBlur={() => setSobre(null)}
          onClick={() => setSeleccionado(id)} onKeyDown={event => teclado(event, id)}
        >
          <span className={styles.orbita} aria-hidden="true" /><Icono size={id === 'motor' ? 34 : 23} strokeWidth={1.45} aria-hidden="true" /><span className={styles.testigo} aria-hidden="true" />
        </button>)}
        <div className={styles.controles}>
          <button type="button" onClick={() => setPausado(p => !p)} disabled={movimientoReducido} aria-pressed={pausado} aria-label={pausado ? 'Reanudar animación' : 'Pausar animación'} title={movimientoReducido ? 'Movimiento reducido activado' : pausado ? 'Reanudar animación' : 'Pausar animación'}>
            {pausado || movimientoReducido ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}
          </button>
          <button type="button" onClick={restablecer} aria-label="Restablecer posiciones" title="Restablecer posiciones"><RotateCcw size={16} aria-hidden="true" /></button>
        </div>
        <div className={styles.detalle} role="status" aria-live="polite">{detalle && <><strong>{detalle.titulo}</strong><span>{detalle.detalle}</span></>}</div>
      </div>
    </section>
  );
}
