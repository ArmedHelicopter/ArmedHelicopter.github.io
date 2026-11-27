import * as THREE from 'three';
import { createCampusPalette } from './materials.js';
import { createTerrainComponent } from './terrain.js';
import { createDormitoryComponent } from './dormitory.js';
import { createLibraryComponent } from './library.js';
import { createScienceComponent } from './science.js';
import { createLakeComponent } from './lake.js';
import { createFoliageComponent } from './foliage.js';

/**
 * Composes all independent 2.5D WHU campus diorama components into one root group
 * while keeping each landmark modular (`terrain`, `dormitory`, `library`, `science`, `lake`, `foliage`)
 * for effortless standalone editing.
 */
export function createCampusDiorama(textures, prebuiltComponents = null) {
  const group = new THREE.Group();
  group.name = 'whu-campus-diorama';

  const palette = prebuiltComponents?.palette || createCampusPalette(textures);
  const terrain = prebuiltComponents?.terrain || createTerrainComponent(textures, palette);
  const dormitory = prebuiltComponents?.dormitory || createDormitoryComponent(textures, palette);
  const library = prebuiltComponents?.library || createLibraryComponent(textures, palette);
  const science = prebuiltComponents?.science || createScienceComponent(textures, palette);
  const lake = prebuiltComponents?.lake || createLakeComponent(textures, palette);
  const foliage = prebuiltComponents?.foliage || createFoliageComponent(textures, palette);

  group.add(terrain.group);
  group.add(dormitory.group);
  group.add(library.group);
  group.add(science.group);
  group.add(lake.group);
  group.add(foliage.group);

  function setMood(mood) {
    palette.setMood(mood);
    terrain.setMood(mood);
    dormitory.setMood(mood);
    library.setMood(mood);
    science.setMood(mood);
    lake.setMood(mood);
    foliage.setMood(mood);
  }

  function updateCampus(dt, elapsed, camPos = null) {
    palette.sharedTimeUniform.value = elapsed;
    lake.update(dt, elapsed);
    foliage.update(dt, elapsed, camPos);
  }

  return {
    group,
    components: { terrain, dormitory, library, science, lake, foliage },
    setMood,
    updateCampus,
    updateWaterReflection: (renderer, scene, camera, keyLight, setSkyLinearOutput, protagonistGroup = null) =>
      lake.updateWaterReflection(renderer, scene, camera, keyLight, setSkyLinearOutput, foliage, protagonistGroup),
    setReflectionSize: lake.setReflectionSize,
    setWaterLinearOutput: lake.setWaterLinearOutput,
    syncShadowLight: lake.syncShadowLight,
  };
}
