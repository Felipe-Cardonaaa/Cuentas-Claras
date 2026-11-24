import Dexie, { type Table } from 'dexie';
import type {
  Abono, Ajuste, Cliente, Devolucion, Historial, Lote, Producto, SaldoInicial, Usuario, Vaciado, Venta,
} from '../dominio/tipos';

export type Tabla =
  | 'usuarios' | 'clientes' | 'productos' | 'lotes' | 'ventas' | 'vaciados' | 'abonos' | 'saldosIniciales' | 'devoluciones' | 'ajustes';

export const TABLAS: Tabla[] = ['usuarios', 'clientes', 'productos', 'lotes', 'ventas', 'vaciados', 'abonos', 'saldosIniciales', 'devoluciones', 'ajustes'];

export interface FilaSalida { orden?: number; tabla: Tabla | 'historial'; registro: object }
export interface Meta { clave: string; valor: unknown }

export class CuentasDB extends Dexie {
  usuarios!: Table<Usuario, string>;
  clientes!: Table<Cliente, string>;
  productos!: Table<Producto, string>;
  lotes!: Table<Lote, string>;
  ventas!: Table<Venta, string>;
  vaciados!: Table<Vaciado, string>;
  abonos!: Table<Abono, string>;
  saldosIniciales!: Table<SaldoInicial, string>;
  devoluciones!: Table<Devolucion, string>;
  ajustes!: Table<Ajuste, string>;
  historial!: Table<Historial, string>;
  salida!: Table<FilaSalida, number>;
  meta!: Table<Meta, string>;

  constructor(nombre = 'cuentas-claras') {
    super(nombre);
    this.version(1).stores({
      usuarios: 'id',
      clientes: 'id, nombreNormalizado',
      productos: 'id, nombreNormalizado',
      lotes: 'id, productoId',
      ventas: 'id, clienteId, loteId, grupoId',
      vaciados: 'id, loteId',
      abonos: 'id, clienteId',
      saldosIniciales: 'id, clienteId',
      devoluciones: 'id, clienteId',
      historial: 'id, registroId',
      salida: '++orden',
      meta: 'clave',
    });
    this.version(2).stores({ ajustes: 'id' });
  }
}

export const db = new CuentasDB();
