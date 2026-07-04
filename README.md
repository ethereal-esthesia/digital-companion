# Digital Companion

> An open-source desktop companion platform for VRM and MMD (PMX) characters.

**Digital Companion** aims to bring interactive 3D characters to the desktop, local applications, and eventually online experiences.

The long-term goal is to support expressive companions that can:
- Load **VRM** and **PMX** characters.
- Animate, emote, and react in real time.
- Interact with desktop applications.
- Connect to local or online AI backends.
- Allow creators to package and share companion characters.

---

## Current Status

⚠️ **Work in Progress**

This repository is an early prototype.

At the moment the application is primarily a local rendering demo used to develop the rendering pipeline and character system.

Current features include:

- VRM model loading
- PMX model loading
- Basic renderer
- Character preview controls
- Lighting presets
- Bloom, saturation and post-processing controls
- Local resource configuration
- Model presets

No networking or AI interaction is implemented yet.

---

## Vision

The goal is to evolve this into a complete companion platform capable of running:

- Desktop companions
- Embedded web companions
- Local AI companions
- Server-hosted companions
- Shared virtual assistants

Characters should eventually be able to:

- Speak
- Animate
- React to applications
- Follow the user
- Display emotions
- Support physics and accessories
- Be extended through plugins

---

## Resources

Models, animations, motions and textures are loaded from the local `resources/` directory.

Eventually any compatible assets placed into the resource folders should become available automatically without modifying application code.

Planned supported formats include:

- VRM
- PMX
- VMD
- Additional asset formats as support is added

---

## Roadmap

- [x] VRM loading
- [x] PMX loading
- [x] Local resource configuration
- [x] Web rendering pipeline
- [ ] Desktop rendering pipeline
- [ ] VMD animation playback
- [ ] Physics improvements
- [ ] Companion behavior system
- [ ] AI integration
- [ ] Voice synthesis
- [ ] Desktop interaction
- [ ] Plugin system
- [ ] Asset manager
- [ ] Online companion server
- [ ] Cross-platform releases

---

## Running

```bash
npm install
npm run dev
```

Then open the local development URL shown by Vite.

---

## License

See the LICENSE file.
