# Sky Studio Sorteo — inicio desde cero

Este es un **prototipo visual en modo demostración**, no una plataforma lista para vender boletas.

## Requisitos
- Node.js LTS instalado
- Cuenta de GitHub
- Cuenta de Supabase

## Ejecutar en tu computador
1. Descomprime el proyecto.
2. Abre la carpeta `sky-studio-sorteo` en Visual Studio Code.
3. Abre Terminal > New Terminal.
4. Ejecuta:

   ```bash
   npm install
   npm run dev
   ```

5. Abre la dirección local que muestre Vite (normalmente `http://localhost:5173`).

## Qué incluye esta primera base
- Diseño adaptable negro, morado y metal.
- Página pública de muestra.
- Cuadrícula de números 00–99.
- Solicitud de boleta en modo local.
- Panel de administración de demostración.
- Estados disponible, pendiente, activa y apagada.
- QR ilustrativos de demostración.
- Exportación de datos demo.
- Primer esquema SQL para Supabase.

## Límites importantes
- Los datos de esta demostración viven en memoria del navegador y se pierden al recargar.
- El panel de administración no tiene autenticación real.
- Los QR son ilustrativos y no autentican una boleta real.
- No hay pagos ni reservas reales.
- El esquema SQL activa RLS sin políticas públicas; falta implementar las políticas y funciones seguras.
- No desplegar ni aceptar pagos hasta completar backend, autenticación, validación de QR, auditoría, reglas de sorteo y pruebas.

## Supabase
1. Crea un proyecto nuevo en Supabase.
2. Abre SQL Editor.
3. Ejecuta `supabase/schema.sql`.
4. Guarda URL y clave pública en un archivo `.env.local` basado en `.env.example`.
5. Nunca pongas la `service_role` key en el navegador ni la subas a GitHub.

## Regla de los tres resultados
El sistema debe guardar, antes de abrir el sorteo, la fecha y el resultado oficial asignado a cada premio. La fórmula exacta para convertir cada resultado en número de boleta, y el procedimiento para números no elegibles, debe publicarse antes de vender. No cambiar reglas después de conocer resultados.
