import * as THREE from 'three';
import { BUILDINGS, type BuildingId } from '../sim/data';

export interface GalleryPlacement {
  name: string; x: number; z: number;
  size?: [number, number]; caption?: string;
}
export const UPGRADE_LINES: { title: string; types: BuildingId[] }[] = [
  { title: '渔业 · 三级升级', types: ['fishery', 'fishpier', 'fishport'] },
  { title: '蔬菜 · 升级与配套', types: ['garden', 'vegfield', 'compost'] },
  { title: '温室 · 两级升级', types: ['greenhouse', 'hydroponic'] },
  { title: '医疗 · 三级升级', types: ['herbalist', 'clinic', 'hospital'] },
  { title: '麦田 · 两级升级', types: ['farm', 'mechfarm'] },
];

export function linePlacements(): GalleryPlacement[] {
  return UPGRADE_LINES.flatMap((row, i) => {
    const z = (i - (UPGRADE_LINES.length - 1) / 2) * 6;
    return [
      { name: 'house_peasant_0', x: -9.2, z, size: BUILDINGS.house.size, caption: '农舍 · 2×2' },
      { name: 'villager_body', x: -7.5, z: z + 0.3, caption: '居民' },
      ...row.types.map((type, col) => ({
        name: BUILDINGS[type].model, x: -3.8 + col * 5.6, z,
        size: BUILDINGS[type].size,
        caption: `${BUILDINGS[type].name} · ${BUILDINGS[type].size.join('×')}\n${BUILDINGS[type].model}`,
      })),
    ];
  });
}

/** Rectangular footprint at the plate surface: exactly one line per map tile. */
export function footprintGrid([w, h]: [number, number]) {
  const group = new THREE.Group();
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(w, h).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: '#9ABFD8', transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }));
  pad.position.y = 0.126;
  const points: number[] = [];
  for (let x = -w / 2; x <= w / 2; x++) points.push(x, 0.132, -h / 2, x, 0.132, h / 2);
  for (let z = -h / 2; z <= h / 2; z++) points.push(-w / 2, 0.132, z, w / 2, 0.132, z);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  group.add(pad, new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: '#4E6C89', transparent: true, opacity: 0.8 })));
  return group;
}
