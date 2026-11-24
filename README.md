# Cuentas Claras

App para el celular que reemplaza la libreta del puesto de la plaza: anota ventas hablando o escribiendo, lleva los lotes de canastillas, los fiados con sus abonos, las canastillas prestadas y el cierre del día. Funciona sin señal y se sincroniza entre los celulares de la familia.

- Diseño: `docs/superpowers/specs/2026-11-23-cuentas-claras-design.md`
- Plan: `docs/superpowers/plans/2026-11-23-cuentas-claras.md`

## Cómo se anota

| Qué pasó | Qué se dice o escribe |
|---|---|
| Venta fiada | `Marta compró 2 canastillas de mango criollo a 45.000 debe` |
| Venta pagada, empacada | `Marta compró 2 canastillas de mango criollo a 45.000 pagó empacado` |
| Varios productos | `Marta compró 1 canastilla de mango criollo a 45.000 y 1 de zapote a 50.000 debe` |
| Cliente de paso | `vendí 2 canastillas de mango criollo a 45.000 pagó` |
| Fiado por kilo | `Pedro compró 8 kilos de mandarina a 4.000 debe` |
| Abono | `Marta abonó 40.000` |
| Pagó toda la deuda | `Marta pagó todo` |
| Devolvió canastillas | `Marta devolvió 2 canastillas` |
| Entró mercancía | `entraron 50 canastillas de mango criollo a 36.000` (el costo es opcional) |
| Entró por kilos | `entraron 200 kilos de mandarina por 900.000` (la app pregunta en cuántas canastillas llegó) |
| Se vaciaron canastillas | `se vaciaron 2 canastillas de mandarina` |
| Deuda vieja de la libreta | `Marta debía 150.000` |

## Para programar

```bash
npm install
npm test
npm run dev
```

## Ponerla a funcionar (una sola vez)

Sin estos pasos la app funciona, pero cada celular guarda sus datos por separado.

1. **Crear la base de datos (gratis):** entra a https://supabase.com, crea una cuenta y un proyecto nuevo (plan Free).
2. **Crear las tablas:** en el proyecto, abre **SQL Editor**, pega todo el contenido de `supabase/migrations/0001_inicial.sql` y pulsa **Run**.
3. **Crear la cuenta del negocio:** en **Authentication → Users → Add user**, crea un usuario con un correo y una clave. Esa es la cuenta con la que cada celular entra la primera vez.
4. **Dar acceso solo a esa cuenta:** en **SQL Editor** ejecuta (cambiando el correo):
   ```sql
   insert into cuentas_negocio (uid) select id from auth.users where email = 'correo-del-negocio@ejemplo.com';
   ```
   Y en **Authentication → Sign In / Providers**, apaga **Allow new users to sign up**, para que nadie más pueda crear cuentas.
5. **Conectar la app:** en **Project Settings → API** copia la *Project URL* y la *anon public key*. Crea un archivo `.env` (copia de `.env.example`) con esos dos valores.
6. **Publicar la app (gratis):** ejecuta `npm run build` y sube la carpeta `dist/` a Netlify (https://app.netlify.com/drop, arrastrando la carpeta) o a Vercel. Te da un enlace.
7. **Instalar en cada celular:** abre el enlace.
   - **Android (Chrome):** menú ⋮ → **Agregar a pantalla de inicio**.
   - **iPhone (Safari):** botón Compartir → **Agregar a inicio**.
8. **Primera vez en cada celular:** entra con el correo y la clave del negocio. En el primer celular, cada persona crea su usuario con su PIN de 4 números; en los demás celulares los usuarios aparecen solos, solo hay que tocar el nombre y poner el PIN.

## Publicación automática

Netlify publica la app sola cada vez que hay un cambio en la rama `main` (configuración en `netlify.toml`).
En el plan gratis de Netlify con repositorio privado, los commits deben ir firmados por la cuenta de GitHub del dueño
(`Felipe-Cardonaaa`); si no, Netlify los bloquea con "Unrecognized Git contributor".
