# La Comarca · Alojamientos en Las Toninas

Sitio estático, responsive y sin dependencias de PHP. El catálogo, los filtros,
las galerías y el detalle se generan desde `imagenes/data.json`.

## Estructura

```text
.
├── index.html          # Inicio, filtros, catálogo, ubicación y contacto
├── complejos.html      # Página para buscar y explorar complejos
├── styles.css          # Diseño responsive, tipografía y componentes compartidos
├── app.js              # Inicio: catálogo, filtros, galerías, compartir y WhatsApp
├── complejos.js        # Directorio de complejos y filtros de búsqueda
├── CNAME               # Dominio personalizado de GitHub Pages
└── imagenes/
    ├── data.json       # Complejos, unidades, descripciones e imágenes
    ├── principal/      # Fotos de portada por complejo
    └── uploads/        # Fotos locales referenciadas por el JSON
```

## Ejecutar localmente

La página usa `fetch()` para leer el JSON, por eso abrila a través de un servidor
HTTP local en lugar de abrir `index.html` como `file://`.

```bash
python3 -m http.server 8000
```

Luego visitá <http://localhost:8000>.

## Publicar en GitHub Pages

El sitio se publica desde la rama `main`, carpeta raíz. El archivo `CNAME`
configura `lastoninasbeach.com.ar` como dominio personalizado.

En Cloudflare, agregá estos registros DNS para el dominio raíz:

| Tipo | Nombre | Contenido |
| --- | --- | --- |
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |

Dejá los registros como **DNS only** durante la verificación y emisión del
certificado HTTPS. La propagación y el certificado pueden demorar. `www` es
opcional; si se usa, creá un CNAME hacia `lukasbrzz.github.io`.

## JSON e imágenes

`app.js` carga `./imagenes/data.json`, lee las listas `complejos` y `duplex` y
relaciona cada unidad con su complejo mediante `complejo_id`. Cada galería
conserva el orden de `imagenes` en el JSON. Las rutas actuales, por ejemplo
`uploads/1781181826522.jpg`, se resuelven como
`./imagenes/uploads/1781181826522.jpg`. También admite rutas que ya comiencen
con `imagenes/`, `./imagenes/` o una URL absoluta.

Para sumar o editar un alojamiento, modificá el JSON existente y colocá sus
fotos dentro de `imagenes/` (habitualmente `imagenes/uploads/`). Usá el `id`
de un elemento de `complejos` en `complejo_id` y agregá a `imagenes` las rutas
relativas en el orden deseado. Los filtros de complejo y capacidad utilizan
los campos `complejo_id` y `capacidad`; los de Wi-Fi y mascotas usan `wifi` y
`mascotas`. Parrilla y cochera se detectan en la descripción actual.

## Inicio y página de complejos

`index.html` es el inicio y catálogo general. Incluye la búsqueda por complejo,
capacidad y comodidades, además de un acceso directo al directorio. En
`complejos.html` se pueden buscar los complejos por nombre o filtrar por
comodidades; cada tarjeta abre el inicio con el catálogo filtrado a ese
complejo. Ambas páginas leen los mismos datos del JSON.

La tipografía y los textos de lectura se ampliaron para facilitar la lectura;
las etiquetas decorativas y metadatos conservan un tamaño menor.

En Inicio se muestran tres unidades al principio. El botón **Ver más
alojamientos** despliega las restantes y cambia a **Ver menos alojamientos**;
al aplicar filtros, vuelve a la vista resumida. La portada también incluye una
galería de tarjetas para explorar los complejos.

Las fotos principales se configuran en `imagen_principal` para cada complejo:
Complejo 1 usa `principal/1.jpg`, Complejo 2 `principal/3.jpg`, Complejo 3
`principal/5.jpg`, Complejo 4 `principal/4.jpg` y Departamento Calle 1
`principal/2.jpg`. La portada usa la foto de Complejo 1. Si una foto configurada
no está disponible, se usa temporalmente la primera foto de una unidad.

Las cinco fotos principales están en `imagenes/principal/` y sus rutas se
verificaron en el catálogo. En el pie de ambas páginas figura el crédito de
desarrollo y un enlace de WhatsApp para consultas de sitios web.

En `index.html` se agregó una sección para contingentes de patín artístico,
basada en las descripciones existentes de las unidades. La agenda, fechas y
tarifas concretas quedan a consulta, ya que el sitio de referencia no pudo
recuperarse desde este entorno. Las fotos de patín y los atractivos turísticos
se leen desde `imagenes/principal/` (`patin1.jpg`, `patin2.jpg`, `patin3.jpg`,
`teatro.png`, `carnaval.png`, `laberinto.png` y `respiro.jpeg`). La foto
`respiro.jpeg` ilustra la sección “Un respiro cerca del mar”. En las tarjetas
turísticas se muestran las fotos locales y el enlace abre su ubicación en
Google Maps.

## Datos de contacto y revisión pendiente

El entorno no pudo recuperar `https://lastoninasbeach.com.ar/` (falló el acceso
de red), así que no se pudo comprobar de forma independiente la vigencia del
correo ni las direcciones. El contacto y las cinco ubicaciones del JSON son
los datos proporcionados por el usuario. Todo el sitio utiliza un único
WhatsApp: `(011) 15-5690-9484`.

Las direcciones se muestran en el directorio, en el mapa del inicio y en los
detalles de las unidades. Los enlaces de Google Maps buscan la dirección
proporcionada, pero conviene comprobar en Google Maps que cada resultado ubique
correctamente el inmueble. También faltan por confirmar:

- Horarios de check-in/check-out y reglas de convivencia.
- Si las comodidades inferidas del texto de descripción (parrilla y cochera)
  corresponden a cada unidad.
- Presentación institucional y datos generales vigentes del sitio de referencia.
