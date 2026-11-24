export type Unidad = 'canastilla' | 'kilo';
export type Estado = 'pago' | 'debe';

export interface Base {
  id: string;
  creadoPor: string;
  creadoEn: string;
  actualizadoEn: string;
  borrado: boolean;
}

export interface Usuario extends Base { nombre: string; pinHash: string; pinSal: string }
export interface Cliente extends Base { nombre: string; nombreNormalizado: string }
export interface Producto extends Base { nombre: string; nombreNormalizado: string }
export interface Lote extends Base {
  productoId: string;
  canastillas: number;
  costoTotal: number | null;
  costoDetalle: string | null;
}
export interface Venta extends Base {
  grupoId: string;
  clienteId: string | null;
  productoId: string;
  loteId: string | null;
  unidad: Unidad;
  cantidad: number;
  precioUnitario: number;
  estado: Estado;
  prestada: boolean | null;
}
export interface Vaciado extends Base { loteId: string; cantidad: number }
export interface Abono extends Base { clienteId: string; valor: number }
export interface SaldoInicial extends Base { clienteId: string; valor: number }
export interface Devolucion extends Base { clienteId: string; cantidad: number }
/** Ajustes del negocio que se comparten entre celulares (por ejemplo, la clave del cierre). */
export interface Ajuste extends Base { valor: unknown }

export interface Historial {
  id: string;
  tabla: string;
  registroId: string;
  usuarioId: string;
  fecha: string;
  accion: 'crear' | 'editar' | 'borrar';
  antes: unknown;
  despues: unknown;
}

export interface Datos {
  clientes: Cliente[];
  productos: Producto[];
  lotes: Lote[];
  ventas: Venta[];
  vaciados: Vaciado[];
  abonos: Abono[];
  saldosIniciales: SaldoInicial[];
  devoluciones: Devolucion[];
}
