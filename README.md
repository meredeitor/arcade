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
