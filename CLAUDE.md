# TesisWeb

Página web estática para publicar y presentar mi tesis profesional de Ingeniería Mecatrónica.

## Tesis

- **Título:** "Reconocimiento y clasificación de objetos usando inteligencia artificial basada en SVM y visión estereoscópica"
- **Carrera:** Ingeniería Mecatrónica
- **Año de desarrollo y sustentación:** 2013

## Objetivo

Mostrar de forma clara y formal la información de la tesis: resumen, capítulos, presentación de la sustentación, descarga del PDF y datos del autor.

## Idioma

- Todo el contenido del sitio en **español**.

## Secciones del sitio

- Inicio / portada (título, autor, asesor, institución, lugar)
- Resumen (abstract)
- El problema (¿qué resuelve? + pipeline del sistema)
- Objetivos (general y específicos)
- Capítulos / índice + proyectos que inspiraron el trabajo
- Resultados y hallazgos
- Aplicaciones futuras
- Presentación de la sustentación (Prezi embebido)
- Juego interactivo «Sé el hiperplano» (trazar un separador y compararlo con el SVM)
- Descarga del PDF de la tesis + cómo citar
- Datos del autor (portada y pie de página)

## Stack

- HTML, CSS y JavaScript plano (sin frameworks)
- Sin build tools por ahora

## Estructura

- `index.html` — página principal
- `css/tokens.css` — variables del sistema de diseño (colores, tipografía, espaciado, radios, sombras)
- `styles.css` — estilos (consumen los tokens)
- `script.js` — interactividad
- `js/juego.js` — lógica del juego interactivo «Sé el hiperplano»
- `assets/` — favicon, fuente Inter (`fonts/`) y PDF de la tesis

## Diseño

- Estilo **académico / formal**, basado en el sistema de diseño MassiveStar (handoff de Claude Design).
- **Modo claro** (light mode): neutros fríos + un único acento burdeos `#7A2237`.
- Tipografía **Inter** (variable, autoalojada), jerarquía por tamaño/peso/espacio.
- Bordes hairline (0.5px), sombras sutiles, radios moderados, espaciado base-4.
- Referencia a la universidad en texto (portada y pie de página).

## Despliegue

- Publicación en **GitHub Pages**.
- Nombres de archivos y carpetas en minúsculas (kebab-case) por compatibilidad con servidores sensibles a mayúsculas.

## Convenciones

- Nombres de archivos y carpetas en minúsculas (kebab-case).
- Indentación de 2 espacios.
- HTML semántico (uso de `<header>`, `<main>`, `<section>`, `<footer>`, etc.).
