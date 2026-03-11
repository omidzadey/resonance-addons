# Resonance Addons

Resonance Addons is a collection of addons for [Resonance](https://resonance.stkc.win).

## Addons

| Addon | Public Instance | Description | Auth |
|-------|---------|-------------|------|
| YouTube Music | https://ytm-resonance.itsnebula.net | Stream, browse, queue, lyrics, library | Google OAuth refresh token |
| Apple Music | https://am-resonance.itsnebula.net | Lyrics, metadata, and artwork | Apple Media User Token |
| Spotify | https://spotify-resonance.itsnebula.net | Lyrics, metadata, catalog, library, DJ, TTS | sp_dc cookie |
| TorBox | https://torbox-resonance.itsnebula.net | Stream music from cached torrents | TorBox API key |

## Self Hosting

### Docker (recommended)

Run all 4 addons using Docker Compose:

```bash
docker compose up -d
```

Or, run an individual service:

```bash
docker compose up -d ytm-addon
```

### Manual

Always refrain from running web applications bare metal in production. Use this for development only.

Install dependencies for all packages:

```bash
bun install
```

Start a specific addon:

```bash
bun run dev:ytm
bun run dev:am
bun run dev:spotify
bun run dev:torbox
```

## License

Resonance Addons is licensed under [GPL-3.0](https://github.com/itsnebulalol/resonance-addons/blob/master/LICENSE).
