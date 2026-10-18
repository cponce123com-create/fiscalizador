import Image from 'next/image';

const rutas = [
  'M 90 155 C 170 155 205 120 260 123 S 350 170 420 175 S 560 240 660 300',
  'M 70 300 C 150 300 190 260 275 265 S 430 295 500 300 S 590 300 660 300',
  'M 95 445 C 175 445 205 405 285 410 S 420 355 485 345 S 590 310 660 300',
  'M 660 300 C 760 260 800 170 890 175 S 1010 200 1115 180',
  'M 660 300 C 770 300 820 340 910 350 S 1040 270 1140 260',
  'M 660 300 C 775 345 810 420 900 425 S 1030 435 1140 400',
  'M 660 300 L 660 425 C 660 490 730 500 795 535 S 875 565 950 565 S 1080 565 1170 565',
];

export function BannerRedDatos() {
  return (
    <section
      className="banner-red-datos relative isolate overflow-hidden rounded-2xl border border-emerald-900/30 shadow-sm"
      aria-label="Ilustración de la red de datos de Fiscalizador"
    >
      <Image
        src="/images/red-datos-fiscalizador.webp"
        alt="Red que conecta libros de órdenes, proveedores y municipalidades"
        fill
        priority
        sizes="(max-width: 1152px) 100vw, 1152px"
        className="banner-red-datos__imagen"
      />
      <svg
        className="banner-red-datos__flujo"
        viewBox="0 0 1400 636"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {rutas.map((d, index) => (
          <path key={index} d={d} className="banner-red-datos__ruta" />
        ))}
        {[
          [260, 123], [420, 175], [275, 265], [500, 300], [285, 410],
          [485, 345], [660, 300], [795, 215], [910, 350], [1115, 180],
          [1140, 260], [1140, 400], [795, 535], [950, 565], [1170, 565],
        ].map(([cx, cy], index) => (
          <circle key={index} cx={cx} cy={cy} r="4" className="banner-red-datos__nodo" />
        ))}
      </svg>
    </section>
  );
}
