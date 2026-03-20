# Brainstorming de Diseño - SIG Agroindustrial

## Propuesta 1: Minimalismo Corporativo Moderno
**Probabilidad: 0.08**

### Filosofía de Diseño
Enfoque limpio, profesional y orientado a datos. Inspirado en dashboards financieros y plataformas B2B modernas (Stripe, Notion). Prioriza claridad, legibilidad y eficiencia operativa.

### Principios Fundamentales
1. **Claridad sobre Decoración**: Cada elemento visual tiene propósito funcional
2. **Jerarquía Clara**: Tipografía y espaciado definen importancia visual
3. **Monocromía con Acentos**: Paleta neutral con toques de color estratégicos
4. **Densidad Informativa Óptima**: Máxima información sin saturación visual

### Filosofía de Color
- **Fondo**: Blanco puro (oklch(1 0 0)) para máxima claridad
- **Texto Principal**: Gris oscuro profundo (oklch(0.235 0.015 65)) para contraste perfecto
- **Acentos Primarios**: Azul profesional (oklch(0.623 0.214 259.815)) para CTAs y datos críticos
- **Acentos Secundarios**: Verde suave (oklch(0.6 0.1 142)) para estados positivos
- **Bordes y Divisiones**: Gris muy claro (oklch(0.92 0.004 286.32)) para separación sutil
- **Intención Emocional**: Confianza, profesionalismo, precisión

### Paradigma de Layout
- Sidebar fijo izquierdo (ancho: 240px) con navegación vertical
- Contenido principal con máximo ancho 1280px, centrado
- Grid de 12 columnas para dashboards
- Espaciado base: 8px (múltiplos de 4px para consistencia)
- Márgenes generosos alrededor de contenido para respiración visual

### Elementos Distintivos
1. **Tarjetas de Métrica**: Bordes sutiles, sombra mínima, números grandes en azul
2. **Tablas Limpias**: Filas alternadas con gris muy claro, sin bordes verticales
3. **Iconografía**: Lucide React, peso consistente, 20px para UI, 24px para acciones

### Filosofía de Interacción
- Transiciones suaves (200ms) en hover de elementos interactivos
- Cambio de color sutil en botones (no cambio de fondo completo)
- Feedback inmediato en formularios (validación en tiempo real)
- Toasts para confirmaciones, sin modales innecesarios

### Animación
- Entrada de tarjetas: fade-in + slide-up (300ms, ease-out)
- Hover de filas: cambio de fondo sutil (100ms)
- Transición de páginas: fade (150ms)
- Carga de datos: skeleton screens con pulse suave
- Evitar: animaciones que distraigan del contenido

### Sistema Tipográfico
- **Display/Títulos**: Geist Sans Bold (700) o similar sans-serif moderna, 28-32px
- **Subtítulos**: Geist Sans SemiBold (600), 18-20px
- **Body**: Geist Sans Regular (400), 14-16px
- **Etiquetas/Captions**: Geist Sans Medium (500), 12px
- **Monoespaciado**: IBM Plex Mono para códigos, referencias

---

## Propuesta 2: Agroindustrial Cálido y Accesible
**Probabilidad: 0.07**

### Filosofía de Diseño
Diseño que celebra la naturaleza del negocio agroindustrial. Incorpora elementos visuales que evocan la tierra, el café y la sostenibilidad. Cálido, acogedor pero profesional.

### Principios Fundamentales
1. **Conexión con la Tierra**: Paleta inspirada en café, suelo, plantas
2. **Accesibilidad Prioritaria**: Contraste alto, tipografía legible, espaciado generoso
3. **Narrativa Visual**: Cada sección cuenta una historia del proceso agroindustrial
4. **Calidez Profesional**: Riguroso pero humano, no frío

### Filosofía de Color
- **Fondo Primario**: Crema muy suave (oklch(0.98 0.001 65)) para calidez
- **Acentos Principales**: Marrón café oscuro (oklch(0.4 0.15 45)) para autoridad
- **Acentos Secundarios**: Verde tierra (oklch(0.55 0.12 142)) para crecimiento/sostenibilidad
- **Acentos Terciarios**: Naranja cálido (oklch(0.65 0.18 60)) para energía
- **Texto**: Marrón muy oscuro (oklch(0.2 0.01 45)) en lugar de negro puro
- **Intención Emocional**: Confianza, sostenibilidad, calidez, profesionalismo

### Paradigma de Layout
- Sidebar con gradiente sutil (crema a marrón claro)
- Contenido con secciones separadas por divisores SVG ondulados
- Uso de imágenes de fondo sutiles (texturas de café, hojas)
- Espaciado más generoso que minimalismo (base 10px)
- Tarjetas con bordes redondeados (12-16px) y sombras suaves

### Elementos Distintivos
1. **Tarjetas de Métrica**: Fondo con gradiente sutil, icono grande en color tierra
2. **Divisores**: SVG ondulados entre secciones, colores de la paleta
3. **Iconografía**: Lucide React + iconos personalizados de café/plantas

### Filosofía de Interacción
- Transiciones cálidas (250ms) con easing suave
- Hover con cambio de color a tono más oscuro de la paleta
- Feedback táctil (micro-interacciones suaves)
- Confirmaciones con toasts con iconos temáticos

### Animación
- Entrada de secciones: fade-in + slide-up con bounce suave (400ms)
- Hover: cambio de color + elevación sutil (150ms)
- Transición de páginas: fade con rotación mínima (200ms)
- Carga: skeleton con gradiente animado en colores tierra
- Énfasis: pulso suave en métricas importantes

### Sistema Tipográfico
- **Display**: Merriweather Bold (700) o serif moderna, 32-36px
- **Subtítulos**: Merriweather SemiBold (600), 20-24px
- **Body**: Lato Regular (400), 14-16px
- **Etiquetas**: Lato Medium (500), 12px
- **Monoespaciado**: IBM Plex Mono

---

## Propuesta 3: Neomorfismo Suave y Moderno
**Probabilidad: 0.09**

### Filosofía de Diseño
Diseño contemporáneo que combina elementos de neumorfismo suave con modernidad. Interfaz que se siente tridimensional pero manteniendo claridad. Inspirado en interfaces premium de aplicaciones financieras modernas.

### Principios Fundamentales
1. **Profundidad Sutil**: Sombras y luces crean dimensión sin ser dramáticas
2. **Suavidad Extrema**: Bordes redondeados, transiciones fluidas, sin aristas
3. **Contraste Funcional**: Elementos importantes destacan naturalmente
4. **Modernidad Elegante**: Contemporáneo pero atemporal

### Filosofía de Color
- **Fondo Base**: Gris muy claro (oklch(0.95 0.001 286)) con toque azul frío
- **Superficies Elevadas**: Blanco con toque gris (oklch(0.98 0.001 286))
- **Acentos Primarios**: Azul moderno (oklch(0.55 0.2 260)) para acciones
- **Acentos Secundarios**: Púrpura suave (oklch(0.65 0.12 290)) para datos secundarios
- **Sombras**: Azul muy suave (oklch(0.5 0.05 260) con 15% opacidad)
- **Intención Emocional**: Sofisticación, modernidad, confianza, innovación

### Paradigma de Layout
- Sidebar con gradiente sutil (gris a gris-azul)
- Contenido con tarjetas flotantes (sombra suave, elevación visual)
- Espaciado generoso (base 8px) con aire entre elementos
- Bordes redondeados consistentes (16px para tarjetas, 8px para botones)
- Uso de glassmorphism sutil en overlays

### Elementos Distintivos
1. **Tarjetas Flotantes**: Sombra suave (inset y drop), borde sutil, fondo semi-transparente
2. **Botones Suaves**: Sin borde visible, fondo con sombra interna en hover
3. **Indicadores**: Puntos animados, líneas suaves, barras de progreso redondeadas

### Filosofía de Interacción
- Transiciones ultra suaves (300ms) con easing cubic-bezier personalizado
- Hover con cambio de sombra y elevación (no cambio de color abrupto)
- Feedback háptico visual (cambio de escala mínimo)
- Toasts con fondo semi-transparente y blur

### Animación
- Entrada: fade-in + scale (0.95 → 1) suave (350ms, ease-out)
- Hover: elevación + cambio de sombra (150ms)
- Transición de páginas: fade + blur (200ms)
- Carga: skeleton con shimmer suave en azul
- Énfasis: pulse suave con sombra expandiéndose

### Sistema Tipográfico
- **Display**: Inter Var Bold (700) o similar, 30-34px
- **Subtítulos**: Inter Var SemiBold (600), 18-22px
- **Body**: Inter Var Regular (400), 14-16px
- **Etiquetas**: Inter Var Medium (500), 12px
- **Monoespaciado**: JetBrains Mono

---

## Decisión Final: Minimalismo Corporativo Moderno

Se ha seleccionado **Propuesta 1: Minimalismo Corporativo Moderno** como el enfoque de diseño para SIG Agroindustrial.

### Justificación
- Máxima claridad para un sistema de información geográfica comercial
- Facilita la lectura de datos y métricas (dashboard-heavy)
- Escalable a múltiples módulos futuros sin cambios visuales drásticos
- Profesional, confiable, orientado a resultados
- Accesibilidad excelente con contraste alto

### Paleta Confirmada
- **Primario**: Azul profesional (oklch(0.623 0.214 259.815))
- **Secundario**: Verde suave (oklch(0.6 0.1 142))
- **Fondo**: Blanco puro
- **Texto**: Gris oscuro profundo
- **Bordes**: Gris muy claro

### Tipografía Confirmada
- **Display**: Geist Sans Bold (700)
- **Body**: Geist Sans Regular (400)
- **Monoespaciado**: IBM Plex Mono

### Próximos Pasos
1. Actualizar `client/src/index.css` con paleta y tipografía
2. Crear componentes base (Button, Card, Input, etc.)
3. Construir layout general con sidebar
4. Desarrollar dashboard comercial
5. Implementar páginas de gestión (Clientes, Prospectos, etc.)
