# Identificación de Patrones para Imagenes — Nexo Visión

**Desarrollado por Alonso Ramírez G.** · Inteligencia Artificial aplicada a las TIC.

Continuación de [1.2 Aplicaciones web IA](https://github.com/ALONSORGT1/Aplicaciones-web-IA): conserva la arquitectura HTML/CSS/JavaScript + Python en Vercel, la identidad Nexo y el cambio de tema. El flujo del chat se adapta al análisis visual.

- [Aplicación en GitHub Pages](https://alonsorgt1.github.io/Identificacion-de-Patrones-para-Imagenes/)
- [Aplicación y API en Vercel](https://identificacion-de-patrones-para-imagenes.vercel.app/)

## Uso

1. Carga un JPG, PNG o WebP desde tu dispositivo, arrástralo al recuadro o pega un enlace HTTPS directo a una imagen pública.
2. Escribe, por ejemplo: **«Identifica todos los tornillos y dime cuántos hay»**. También puedes pedir tornillos, tuercas y clavos por separado.
3. El resultado muestra el total, las cantidades por categoría y una marca numerada por objeto.
4. Abre **Imágenes** para comparar la original con la marcada, ampliar ambas y descargar el PNG o los resultados JSON.
5. Haz otra petición sobre la misma imagen o usa **Nuevo análisis**. Cada petición es independiente; indica explícitamente los objetos que deseas buscar.

No se guardan imágenes ni conversaciones en una base de datos. Permanecen en la pestaña y desaparecen al recargar. Se envía una copia de la imagen a OpenAI para el análisis, con `store=False`. Esto no sustituye las políticas de retención del proveedor.

## Modelo y precisión

Se elige **`gpt-6-astra`**, priorizando capacidad de razonamiento visual sobre costo y latencia. Admite imágenes, Responses API y salida estructurada: [documentación del modelo](https://developers.openai.com/api/docs/models/gpt-6-astra). Se usa detalle alto y razonamiento alto; `OPENAI_MODEL` permite cambiarlo por otro modelo compatible sin modificar el frontend.

La IA devuelve cajas normalizadas `[x_min, y_min, x_max, y_max]`, con origen arriba a la izquierda. El servidor valida las coordenadas, elimina duplicados exactos y calcula los totales a partir de las detecciones. El navegador dibuja círculos y números sobre los píxeles de la foto. No se genera una fotografía nueva ni se alteran sus objetos.

Los modelos de visión pueden equivocarse al contar y localizar objetos, especialmente con piezas pequeñas, superpuestas o borrosas: [limitaciones de visión](https://developers.openai.com/api/docs/guides/images-vision). Las marcas deben revisarse visualmente; no se garantiza un conteo exacto. Máximo 150 detecciones por consulta. Para escenas densas utiliza recortes.

## Ejecutar localmente

Con Python instalado, desde esta carpeta:

```powershell
python scripts/serve.py
```

Abre **http://localhost:5500**. Usa el backend publicado en Vercel y su clave privada; no necesitas subir cambios a GitHub para probar el frontend. También funciona con Live Server, localhost y 127.0.0.1 en otros puertos. No abras el HTML con `file://`.

Para trabajar también en el backend, instala Vercel CLI, conecta este proyecto con `vercel link`, descarga las variables con `vercel env pull .env.local`, ejecuta `vercel dev` y cambia temporalmente `API_URL` en `assets/js/app.js` a `http://localhost:3000/api/analyze`. No publiques esa URL local.

## Variables de Vercel

| Variable | Configuración |
|---|---|
| `OPENAI_API_KEY` | Misma clave del proyecto 1.2; solo en el servidor. |
| `OPENAI_MODEL` | `gpt-6-astra` |
| `ALLOWED_ORIGINS` | `https://alonsorgt1.github.io,https://identificacion-de-patrones-para-imagenes.vercel.app` |
| `ALLOW_LOCALHOST` | `true`, permite `localhost`, `127.0.0.1` y `[::1]` con HTTP/HTTPS en cualquier puerto válido. |

Se admite también la variable anterior `ALLOWED_ORIGIN` si no existe `ALLOWED_ORIGINS`. No incluyas la ruta del repositorio en un origen. `https://github.com` no sirve el frontend: el origen de Pages es `https://alonsorgt1.github.io`.

CORS responde con el origen concreto autorizado, nunca `*`. Rechaza dominios como `localhost.ejemplo.com`. CORS no autentica usuarios: esta aplicación educativa no implementa cuentas ni cuotas por usuario. Las llamadas a OpenAI consumen el saldo de la cuenta configurada.

## Límites y manejo de imágenes

- Archivos de hasta 12 MB y 24 megapíxeles. Sin SVG, GIF ni animaciones.
- Copia de análisis de máximo 2048 px en el lado mayor y petición de menos de 4 MB, compatible con Vercel.
- Los archivos locales mantienen su resolución original en la vista y en la descarga marcada. Las imágenes de URL se normalizan en el servidor hasta 2048 px para poder devolverlas a través de Vercel. Puede cambiar la compresión; se mantiene el contenido fotográfico.
- Para URL se descarga la imagen una sola vez y se analiza esa misma copia. Se validan destinos y redirecciones, se bloquean IP privadas y se fija la IP validada conservando la comprobación TLS.
- Espera de hasta 275 segundos en el navegador y 300 segundos en la función. Cancelar la espera no garantiza cancelar el procesamiento ni el consumo del servidor.
- Errores diferenciados para imágenes inválidas, tamaño, origen, límites de OpenAI y tiempo de espera. No se muestran credenciales ni errores crudos del proveedor.

## API y estructura

`POST /api/analyze` acepta `{ "message": "Cuenta tornillos", "image": "data:image/jpeg;base64,..." }` y devuelve `count`, `counts`, `detections`, `note` y `model`. La imagen marcada se produce en el navegador con Canvas y puede descargarse como PNG.

Para importar una imagen: `{ "action": "load_url", "url": "https://..." }`; devuelve `image`, `width` y `height`. `GET` proporciona un estado de disponibilidad, sin consumir OpenAI.

- `index.html`, `assets/css/styles.css`: interfaz adaptable y panel de comparación.
- `assets/js/app.js`: carga, análisis, círculos, exportación y control de errores.
- `assets/js/theme.js`: tema claro/oscuro reutilizado de 1.2.
- `api/analyze.py`: validación, CORS, descarga y consulta de visión.
- `tests/test_analyze.py`: pruebas de contrato, seguridad de URL, conteos y HTTP sin consumir la API.
- `.github/workflows/pages.yml`: publica solo HTML y assets en Pages.
- `vercel.json`: función Python y configuración de despliegue.

## Pruebas

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt
.\.venv\Scripts\python -m unittest discover -s tests -v
node --check assets/js/app.js
```

La prueba con SDK simulado valida el contrato, no la precisión real. Antes de usarla para un inventario, comprueba con fotografías representativas y conteos manuales.
