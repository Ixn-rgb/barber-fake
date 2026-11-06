# BARBER FAKE

Página de reservas para barbería, con diseño negro/dorado, servicios y panel de administración.

## Incluye
- Bienvenida BARBER FAKE.
- Corte: $70 MXN / 45 minutos.
- Corte con barba: $80 MXN / 60 minutos.
- Reserva con servicio, barbero, fecha, hora, nombre y teléfono.
- El cliente solo ve horarios habilitados y disponibles.
- Panel privado: consulta/cancela citas y configura días, apertura, cierre e intervalo.
- La clave publishable se usa en el navegador; no se incluye ninguna clave secreta.

## Antes de publicar

1. Instala Node.js en una computadora.
2. Descomprime el proyecto y abre una terminal dentro de la carpeta.
3. Ejecuta `npm install`.
4. Copia `.env.example` como `.env` y agrega tu URL y clave publishable de Supabase.
5. En Supabase SQL Editor, revisa y ejecuta `supabase/secure_booking.sql`.
6. Ejecuta `npm run dev` para probar localmente.
7. Para publicar, sube la carpeta a GitHub y conéctala a Vercel. En Vercel agrega las mismas variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.

## Importante
- No compartas contraseñas ni claves `service_role` o `secret`.
- El panel requiere que el usuario autenticado esté en `public.admin_users`.
- `barber_settings.working_days` debe guardar los días como números 0-6 (domingo=0) o nombres de días en español/inglés.
- El proyecto inicial debe tener al menos un barbero activo y un registro en `barber_settings`.
- Antes de abrir reservas al público, verifica políticas RLS y prueba reservas duplicadas, cancelaciones y horarios.
