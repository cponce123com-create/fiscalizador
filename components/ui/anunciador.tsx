export function Anunciador({ mensaje }: { mensaje: string }) {
  return (
    <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {mensaje}
    </p>
  );
}
