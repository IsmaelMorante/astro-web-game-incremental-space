id: requisitos-orbita-titan
rama: feat/orbita-titan

## Requisitos

### R1. Configuración de dependencias y soporte para React y Tailwind v4
- Fuente: Brief del usuario
- Criterio: Modificar `astro.config.mjs` y `tsconfig.json` para soportar `@astrojs/react` y `@tailwindcss/vite`. El usuario instalará los paquetes `@astrojs/react`, `react`, `react-dom`, `lucide-react`, `@tailwindcss/vite`, `tailwindcss` y las dependencias de desarrollo `@types/react` y `@types/react-dom`, con motivo P5 FUNCTIONALITY para montar la interfaz React y Tailwind v4 original.
- Datos personales: no
- Estado: aprobado

### R2. Integración del motor puro y componentes de Órbita Titán
- Fuente: Brief del usuario
- Criterio: Copiar el motor puro y los componentes desde el prototipo a `src/features/orbita-titan/`, manteniendo la persistencia en `localStorage` bajo `astro-incremental-save-v1`. Si existe un guardado antiguo con campos en inglés, `validateSaveData()` lo reinicia de forma segura. Los archivos del prototipo anterior (`src/engine/`, `src/ui/`, `src/audio/`, `src/render/`, `src/persistence/`, `src/components/*.astro`) quedan sin referenciar sin borrarlos físicamente.
- Datos personales: no
- Estado: aprobado

### R3. Montaje del componente principal en la página de inicio
- Fuente: Brief del usuario
- Criterio: Encapsular `App.tsx` como `OrbitTitanGame.tsx` y montarlo en `src/pages/index.astro` mediante `client:only="react"`.
- Datos personales: no
- Estado: aprobado

### R4. Integración de fuentes y estilos tipográficos
- Fuente: Brief del usuario
- Criterio: Cargar `Oxanium`, `DM Sans` y `JetBrains Mono` desde Google Fonts en `src/layouts/Layout.astro`. Mover o eliminar los estilos globales sin capa de `Layout.astro` para no romper Tailwind CSS v4. Verificar ausencia de scroll doble en escritorio (`>= 1024 px`) y móvil (`360 px`).
- Datos personales: no
- Estado: aprobado

### R5. Exclusión de dependencias externas no utilizadas
- Fuente: Brief del usuario
- Criterio: Omitir `express`, `dotenv`, `@google/genai`, `tsx`, `motion`, `@vitejs/plugin-react`, `autoprefixer` y `@types/express` en el proyecto integrado.
- Datos personales: no
- Estado: aprobado

### R6. Verificación automatizada de tipos y compilación
- Fuente: Brief del usuario
- Criterio: Ejecutar con éxito `pnpm check`, `pnpm build` y `pnpm test` (`vitest run`), acotando los tests a los existentes y a los nuevos tests unitarios de `src/features/orbita-titan/game/`.
- Datos personales: no
- Estado: aprobado
