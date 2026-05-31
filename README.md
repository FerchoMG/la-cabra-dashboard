# La Cabra NBA Dashboard

Dashboard web para controlar apuestas deportivas de NBA y MLB conectado a Google Sheets.

## Columnas necesarias en Google Sheets

Cada pestaña debe tener estas columnas exactamente:

Fecha, Partido, Jugador + Mercado, Stake, Cuota, Resultado, Profit, Bankroll

Pestañas actuales configuradas:

- NBA
- MLB

## Configuración actual

El archivo conectado es:

`1g3jc06lKdf2wczWF8RfBHsvBvXcnwZvBN57pr5o8H58`

La app usa el endpoint público de Google Visualization. La hoja debe estar pública o publicada en la web.

## Ejecutar local

```bash
npm install
npm run dev
```

## Publicar en GitHub Pages

1. Crea un repositorio en GitHub.
2. Sube estos archivos.
3. En la terminal:

```bash
npm install
npm run build
npm run deploy
```

4. En GitHub, ve a Settings > Pages y selecciona la rama `gh-pages`.

También puedes usar GitHub Actions si prefieres despliegue automático.
