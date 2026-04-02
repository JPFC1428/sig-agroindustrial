Coloca aqui la plantilla original de Excel de la empresa.

Nombre esperado por defecto:
- `templates/cotizaciones/plantilla-cotizacion.xlsx`

Opcionalmente puedes usar una ruta distinta con:
- `COTIZACION_TEMPLATE_PATH`

Hoja esperada por defecto:
- `Cotización`

Opcionalmente puedes usar otro nombre con:
- `COTIZACION_TEMPLATE_SHEET`

El mapeo actual vive en:
- `server/cotizaciones-excel-template.ts`

Suposiciones actuales del mapeo:
- cliente en `E12`
- fecha en `V12`
- bloque de items desde la fila `17`
- maximo de items preformateados: `25`
- subtotal en `Z44`
- total en `Z46`
- observaciones en `D8`

Si tu plantilla real usa otras celdas, ajusta ese archivo y no la generacion del Excel.
