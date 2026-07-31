# 4DX Power Clash

Juego arcade local para capacitacion de las 4 Disciplinas de la Ejecucion.

## Ejecutar

```bash
node server.js
```

Luego abre:

- Pantalla: `http://localhost:4174/display`
- Facilitador: `http://localhost:4174/host`
- Participantes: `http://localhost:4174/play`

Los celulares deben estar en la misma red que la computadora que ejecuta el servidor.

## Dinamica

- Cada participante entra desde el celular y elige equipo.
- El facilitador lanza una pregunta.
- Gana la ronda el equipo con mas respuestas correctas.
- El ganador sube `+1` en su barra de poder.
- Cada ronda ganada tambien suma un golpe al muro.
- Primer golpe sobre un bloque: se agrieta.
- Segundo golpe sobre ese bloque: se rompe.
- Al llegar a 10 de poder, el equipo lanza el golpe final.

## Version PWA estatica para GitHub Pages

La carpeta `docs/` contiene una version estatica que no depende de Node.js.

Para publicarla:

1. En GitHub abre `Settings`.
2. Entra a `Pages`.
3. En `Build and deployment`, selecciona `Deploy from a branch`.
4. Branch: `main`.
5. Folder: `/docs`.
6. Guarda.

GitHub Pages publicara una URL parecida a:

```text
https://meredeitor.github.io/arcade/
```

Rutas:

- Pantalla: `https://meredeitor.github.io/arcade/`
- Facilitador: `https://meredeitor.github.io/arcade/host.html`

Importante: al ser 100% estatica, no recibe respuestas de celulares automaticamente. El facilitador captura manualmente que equipo gano la ronda. Para respuestas automaticas de celulares se necesita algun servicio de datos compartido, como un backend, Firebase, Supabase o similar.
