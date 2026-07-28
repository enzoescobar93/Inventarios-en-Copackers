# Tablero de Copackers — Grupo Ayudin

Dashboard de control de inventarios en copackers. Se actualiza subiendo el
Excel directamente desde el navegador — no hace falta tocar código ni volver
a desplegar nada.

## Cómo funciona

- `index.html` es el sitio completo (un solo archivo). Lee el Excel **en el
  navegador** (con la librería SheetJS) usando el mismo motor de cálculo que
  ya validamos (`js/extract.js`): agregación por copacker/mes, exclusión del
  ajuste de junio en revisión, stock promedio, rankings Top 20, etc.
- Cuando alguien arrastra un Excel nuevo al cuadro de arriba, el navegador lo
  procesa y lo manda a una función de Netlify (`upload-tablero`), que lo
  guarda en Netlify Blobs.
- Cualquiera que entre al sitio (`get-tablero`) ve automáticamente la última
  versión publicada — no hace falta que cada uno suba el archivo.
- El cronograma de conteos (los tildes por mes) también se guarda compartido
  (`get-conteos` / `save-conteos`), no por navegador.

## Puesta en marcha (una sola vez)

### 1. Crear el repositorio en GitHub

```bash
cd tablero-copackers        # esta carpeta
git init
git add .
git commit -m "Tablero de copackers - version inicial"
```

Después, en GitHub: creá un repositorio nuevo (vacío, sin README) y seguí las
instrucciones que te da GitHub para "push an existing repository":

```bash
git remote add origin https://github.com/TU_USUARIO/tablero-copackers.git
git branch -M main
git push -u origin main
```

### 2. Conectar Netlify

En tu cuenta de Netlify (la misma que ya usás para los otros dos tableros):

1. **Add new site → Import an existing project → Deploy with GitHub**.
2. Elegí el repositorio `tablero-copackers`.
3. Build settings:
   - **Build command**: `npm install`
   - **Publish directory**: `.` (la raíz del repo)
4. Deploy site.

Netlify va a detectar sola las funciones en `netlify/functions/` (por el
`netlify.toml` incluido) — no hace falta configurar nada más.

### 3. Habilitar Netlify Blobs

Netlify Blobs viene habilitado por defecto en sitios nuevos de Netlify (no
requiere ninguna base de datos externa ni configuración adicional). Si tu
cuenta es muy vieja y no lo tiene activado, andá a **Site configuration →
Environment variables** y confirmá que el sitio tenga acceso a Blobs (viene
solo, en el 99% de los casos no hay que tocar nada).

### 4. Primera carga de datos

Entrá al sitio recién publicado y subí el Excel del tablero (el mismo que
venís usando, ya recalculado). Vas a ver el mensaje "Tablero actualizado y
publicado" — a partir de ahí, cualquiera que entre al link va a ver esos
datos.

## Cómo actualizar el tablero cada mes

1. Actualizá y recalculá el Excel como siempre.
2. Entrá al sitio publicado.
3. Arrastrá el Excel al cuadro de arriba (o hacé clic en "Seleccionar
   archivo").
4. Listo — se publica solo para todos, no hace falta redeploy ni tocar
   GitHub.

## Estructura del proyecto

```
tablero-copackers/
├── index.html                       Sitio completo (UI + lógica de render)
├── js/
│   └── extract.js                   Motor que lee el Excel en el navegador
├── netlify/
│   └── functions/
│       ├── upload-tablero.js        Guarda el tablero subido (Netlify Blobs)
│       ├── get-tablero.js           Devuelve el último tablero publicado
│       ├── get-conteos.js           Devuelve el estado del cronograma
│       └── save-conteos.js          Guarda un tilde del cronograma
├── netlify.toml                     Configuración de build y funciones
├── package.json                     Dependencia: @netlify/blobs
└── README.md                        Este archivo
```

## Notas y decisiones tomadas

- **Exclusión de junio 2026**: el ajuste de −$12.781.849,32 del material
  418025001 (PLASTICOS DEL FUTURO SA) queda excluido de todos los cálculos
  por estar en revisión — está hardcodeado en `js/extract.js` (constante
  `EXCLUDE_MONTH`). Si esto se resuelve, hay que borrar esa exclusión del
  archivo y volver a subir un commit.
- **Stock promedio, no suma**: en la fila "Total año" y en el índice
  "% Ajuste s/ Stock Promedio", el stock se promedia sobre los meses con
  datos reales (no se suma, porque es un saldo, no un flujo).
- **Rango de filas en el Excel**: detectamos que las fórmulas de "Resumen
  Ajustes/Consumos/Stocks/Ingresos" en el Excel están acotadas a las filas
  2:359, pero ya hay 359 combinaciones código+copacker cargadas (hasta la
  fila 360). El motor de este tablero lee **todas** las filas de esas hojas
  directamente (no depende del rango recortado de esas fórmulas), así que
  no sufre ese problema — pero conviene ampliar el rango en el Excel de
  todas formas para que el propio archivo no siga mostrando totales
  incompletos cuando lo mirás directamente ahí.
- **FX**: se sacó de las tarjetas individuales (por pedido explícito) y quedó
  solo como una viñeta en el Resumen ejecutivo. El valor está hardcodeado en
  `index.html` (buscá `FX_JUNIO_2026`) — actualizalo ahí cuando cambie el
  tipo de cambio de referencia.
