import { _drawAnimaFluxRing } from "./actor-lifecycle.mjs";

export function registerRegionHooks() {
  // Reset per-scene anima state for all character actors in a scene when it
  // is deactivated (another scene goes active). scenePeripheral drives the
  // derived anima level, so zeroing it is the only reset needed.
  Hooks.on("updateScene", async (scene, changes, _options, _userId) => {
    if (!game.user.isGM) return;
    if (changes.active !== false) return;
    const { clearSceneCharms } = await import("../helpers/charm-deactivation.mjs");
    for (const tokenDoc of scene.tokens) {
      const actor = tokenDoc.actor;
      if (actor?.type !== "character") continue;
      await clearSceneCharms(actor);
      if ((actor.system.scenePeripheral ?? 0) > 0) {
        await actor.update({ "system.scenePeripheral": 0 });
      }
    }
    // Remove all anima flux regions from the deactivated scene.
    const fluxRegions = scene.regions.filter(r => r.flags?.exalted2e?.animaFlux);
    for (const region of fluxRegions) await region.delete();
  });

  // Remove the Anima Flux region when a DB token is deleted from the scene.
  Hooks.on("deleteToken", async (tokenDoc, _options, userId) => {
    if (game.user.id !== userId) return;
    if (!canvas.ready) return;
    const actorId = tokenDoc.actorId;
    if (!actorId) return;
    const region = canvas.scene?.regions.find(r => r.flags?.exalted2e?.animaFluxActorId === actorId);
    if (region) await region.delete();
  });

  // ── Anima Flux Region — visual hooks ──────────────────────────────────────
  // drawRegion: hide the default fill mesh; attach the elemental ring child.
  // refreshRegion: redraw the ring whenever the border/geometry updates.

  Hooks.on("drawRegion", (region) => {
    if (!region.document.flags?.exalted2e?.animaFlux) return;
    // Suppress the default fill by zeroing the highlight mesh alpha.
    const mesh = canvas.regions._highlights.children.find(m => m.region === region);
    if (mesh) mesh.alpha = 0;
    // Add a persistent elemental ring border.
    const ring = new PIXI.Graphics();
    ring.name = "exalted2e-anima-ring";
    region.addChild(ring);
    region._animaFluxRing   = ring;
    region._animaFluxColor  = region.document.flags.exalted2e.animaFluxColor ?? 0xFF8C00;
  });

  Hooks.on("refreshRegion", (region, flags) => {
    if (!region._animaFluxRing) return;
    if (flags.refreshVisibility || flags.refreshState) {
      const mesh = canvas.regions._highlights.children.find(m => m.region === region);
      if (mesh) mesh.alpha = 0;
    }
    if (flags.refreshBorder) _drawAnimaFluxRing(region);
  });
}
