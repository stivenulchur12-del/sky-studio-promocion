# Sky Studio Barbería — plataforma promocional gratuita

Sitio React/Vite para administrar 100 números (00–99), con estados **Disponible**, **En espera** y **Participante confirmado**, panel de administrador y QR firmado con verificación en línea.

> Esta plantilla se ha adaptado a una actividad gratuita: no incluye venta de números ni premio en efectivo. Antes de publicar la actividad, completa y publica términos, fechas, elegibilidad y método de selección; verifica las autorizaciones que correspondan en Colombia. No actives pagos ni añadas premios en dinero.

## Arquitectura

- **GitHub Pages**: aloja la interfaz pública.
- **Supabase Auth**: inicio de sesión del administrador.
- **Supabase Postgres + RLS**: estados y datos de participantes.
- **Supabase Edge Functions**: emisión y verificación de QR HMAC.
- El público solo puede leer número/estado. Los nombres y teléfonos requieren sesión autenticada.

El QR no es “imposible de copiar”: es un identificador firmado y verificable en línea. Una copia del mismo QR seguirá siendo una copia del mismo identificador; la verificación evita crear códigos válidos arbitrarios y permite revocar uno al emitir otro para el mismo número.

## 1. Crear Supabase

1. Crea un proyecto en https://supabase.com/.
2. En **SQL Editor**, ejecuta `supabase/migrations/001_initial.sql`.
3. En **Authentication → Users**, crea tu usuario administrador. Desactiva el registro público (Authentication → Providers / Email, según la interfaz actual).
4. En **Project Settings → API**, copia Project URL y anon/public key.
5. En **Project Settings → Edge Functions → Secrets** (o CLI), configura:
   - `QR_SIGNING_SECRET`: cadena aleatoria larga (mínimo 32 bytes).
   - `PUBLIC_SITE_URL`: URL pública del sitio, por ejemplo `https://TU-USUARIO.github.io/TU-REPO`.
   - Supabase proporciona `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` automáticamente a las Edge Functions. Nunca pongas service role key en el frontend.

### Importante sobre roles

La política SQL de ejemplo permite a cualquier usuario autenticado actualizar filas. Para una instalación real de un solo administrador, crea únicamente tu usuario y desactiva el registro público. No compartas esa cuenta. Para añadir empleados, implementa una tabla de roles y políticas específicas antes de crearles cuentas.

## 2. Desplegar Edge Functions

Instala Supabase CLI y vincula el proyecto:

```bash
supabase login
supabase link --project-ref TU_PROJECT_REF
supabase secrets set QR_SIGNING_SECRET="UNA_CADENA_ALEATORIA_LARGA" PUBLIC_SITE_URL="https://TU-USUARIO.github.io/TU-REPO"
supabase functions deploy issue-ticket-qr
supabase functions deploy verify-ticket
```

## 3. Configurar y probar localmente

```bash
npm install
cp .env.example .env
```

Edita `.env` con el Project URL y anon key:

```env
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=TU_ANON_KEY
```

Después:

```bash
npm run dev
```

Prueba:
- La cuadrícula muestra los 100 números.
- El público ve disponibilidad, nunca nombres ni teléfonos.
- Inicia sesión con tu usuario administrador.
- Selecciona un número y cambia su estado.
- Confirma un participante y genera su QR.
- Abre el QR en otro dispositivo para validar el estado.

## 4. Publicar en GitHub Pages

1. Crea un repositorio público o privado llamado, por ejemplo, `sky-studio-promocion`.
2. Sube todos los archivos de esta carpeta.
3. En GitHub, abre **Settings → Secrets and variables → Actions** y crea:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. En **Settings → Pages**, selecciona **GitHub Actions**.
5. El workflow incluido compila y publica automáticamente al hacer push a `main`.

Si el repositorio se publica bajo `https://usuario.github.io/sky-studio-promocion/`, la configuración Vite de este proyecto usa el nombre del repositorio como base.

## 5. Reglas y transparencia de la promoción

Antes de abrir participación, completa y publica:
- Organizador: Sky Studio Barbería.
- Quiénes pueden participar y restricciones.
- Confirmación de que participar es gratuito y no exige compra.
- Fechas de apertura y cierre.
- Cantidad de números y mecanismo para asignarlos.
- Fecha, fuente y procedimiento verificable de selección.
- Descripción y condiciones de redención de los servicios.
- Tratamiento de datos personales y canal de contacto.
- Qué sucede con números disponibles o participantes que no cumplan requisitos.

La antigua idea de usar un resultado de lotería como mecanismo de selección no queda activada por defecto. Valida las reglas y permisos aplicables con la autoridad competente antes de escoger el mecanismo final.

## Archivos principales

- `src/App.jsx`: interfaz pública y panel admin.
- `src/style.css`: diseño responsive.
- `supabase/migrations/001_initial.sql`: base de datos y permisos.
- `supabase/functions/issue-ticket-qr`: emisión QR.
- `supabase/functions/verify-ticket`: verificación en línea.
- `.github/workflows/deploy.yml`: despliegue automático.

## Limitaciones de esta primera versión

- La interfaz de selección y asignación es administrativa; no hay formulario público de inscripción.
- La base de datos mantiene datos personales privados respecto a usuarios anónimos.
- El control de acceso presupone que solo tú creas cuentas en Supabase.
- El QR confirma que el número fue emitido por el sistema y que sigue confirmado; no sustituye la verificación de identidad del participante.
