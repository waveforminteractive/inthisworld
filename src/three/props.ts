import * as THREE from 'three';

function mat(color: string, roughness = 0.75, metalness = 0.03): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness, metalness });
}

function box(
  parent: THREE.Object3D,
  size: [number, number, number],
  position: [number, number, number],
  color: string,
  rotation: [number, number, number] = [0, 0, 0],
  roughness = 0.75,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat(color, roughness));
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function cyl(
  parent: THREE.Object3D,
  radiusTop: number,
  radiusBottom: number,
  height: number,
  position: [number, number, number],
  color: string,
  segments = 10,
  rotation: [number, number, number] = [0, 0, 0],
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments), mat(color));
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function sphere(
  parent: THREE.Object3D,
  radius: number,
  position: [number, number, number],
  color: string,
  widthSegments = 10,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, widthSegments, 8), mat(color));
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export interface PropBuild {
  group: THREE.Group;
  height: number;
  focusY: number;
}

export function buildProp(id: string): PropBuild | null {
  const group = new THREE.Group();
  let height = 2;
  switch (id) {
    case 'prop-house': {
      box(group, [5, 3, 4], [0, 1.5, 0], '#d8c39a');
      box(group, [5.6, 0.3, 4.6], [0, 3.05, 0], '#8f5d3f');
      const roof = new THREE.Mesh(new THREE.ConeGeometry(3.9, 1.9, 4), mat('#8f4f3a'));
      roof.position.set(0, 4, 0);
      roof.rotation.y = Math.PI / 4;
      roof.castShadow = true;
      group.add(roof);
      box(group, [1, 1.8, 0.12], [0, 0.9, 2.03], '#6a4a32');
      box(group, [0.9, 0.8, 0.1], [-1.5, 1.9, 2.03], '#8fd3e8');
      box(group, [0.9, 0.8, 0.1], [1.5, 1.9, 2.03], '#8fd3e8');
      height = 5;
      break;
    }
    case 'prop-tree': {
      cyl(group, 0.28, 0.4, 2.6, [0, 1.3, 0], '#7a5233', 8);
      sphere(group, 1.7, [0, 3.2, 0], '#4d8b4a');
      sphere(group, 1.2, [-1.1, 3.6, 0.3], '#5b9a55');
      sphere(group, 1.15, [1, 3.5, -0.2], '#407c3f');
      height = 4.9;
      break;
    }
    case 'prop-pine': {
      cyl(group, 0.22, 0.32, 2, [0, 1, 0], '#6b4529', 8);
      const layers = [
        { r: 1.8, h: 2, y: 2.2 },
        { r: 1.35, h: 1.8, y: 3.3 },
        { r: 0.9, h: 1.6, y: 4.3 },
      ];
      for (const layer of layers) {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(layer.r, layer.h, 8), mat('#2f6b45'));
        cone.position.y = layer.y;
        cone.castShadow = true;
        group.add(cone);
      }
      height = 5.2;
      break;
    }
    case 'prop-rock': {
      const rock1 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.3, 0), mat('#7c7f86'));
      rock1.position.y = 0.9;
      rock1.scale.set(1.2, 0.8, 1);
      rock1.castShadow = true;
      rock1.receiveShadow = true;
      group.add(rock1);
      const rock2 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.7, 0), mat('#676a70'));
      rock2.position.set(1.2, 0.45, 0.6);
      rock2.rotation.y = 1.2;
      rock2.castShadow = true;
      group.add(rock2);
      height = 2;
      break;
    }
    case 'prop-fence': {
      for (const x of [-2, 0, 2]) box(group, [0.22, 1.5, 0.22], [x, 0.75, 0], '#9a7448');
      box(group, [4.4, 0.18, 0.14], [0, 1.12, 0], '#b08a5a');
      box(group, [4.4, 0.18, 0.14], [0, 0.62, 0], '#b08a5a');
      height = 1.5;
      break;
    }
    case 'prop-sign': {
      cyl(group, 0.12, 0.14, 2, [0, 1, 0], '#7b5535', 8);
      box(group, [1.9, 1, 0.16], [0, 2.1, 0], '#d7b57a');
      box(group, [1.5, 0.1, 0.02], [0, 2.3, 0.1], '#7b5535');
      box(group, [1.5, 0.1, 0.02], [0, 2.05, 0.1], '#7b5535');
      height = 2.6;
      break;
    }
    case 'prop-car': {
      box(group, [3.6, 0.8, 1.8], [0, 0.8, 0], '#d24c4c');
      box(group, [2, 0.7, 1.6], [-0.1, 1.55, 0], '#e8e8ea');
      box(group, [1.9, 0.55, 1.62], [-0.1, 1.6, 0], '#9ad7e8');
      for (const x of [-1.15, 1.15]) {
        for (const z of [-0.85, 0.85]) {
          const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.25, 12), mat('#23262b', 0.9));
          wheel.rotation.x = Math.PI / 2;
          wheel.position.set(x, 0.38, z);
          wheel.castShadow = true;
          group.add(wheel);
        }
      }
      height = 2;
      break;
    }
    case 'prop-bench': {
      box(group, [2.6, 0.16, 0.7], [0, 0.85, 0], '#a5743e');
      box(group, [2.6, 0.5, 0.14], [0, 1.25, -0.35], '#a5743e');
      for (const x of [-1, 1]) {
        box(group, [0.14, 0.8, 0.5], [x, 0.4, 0], '#3d4348');
      }
      height = 1.5;
      break;
    }
    case 'prop-barrel': {
      cyl(group, 0.55, 0.55, 1.3, [0, 0.65, 0], '#9a6a37', 12);
      cyl(group, 0.58, 0.58, 0.12, [0, 0.35, 0], '#5c4a35', 12);
      cyl(group, 0.58, 0.58, 0.12, [0, 0.95, 0], '#5c4a35', 12);
      height = 1.3;
      break;
    }
    case 'prop-crate': {
      box(group, [1.2, 1.2, 1.2], [0, 0.6, 0], '#b07d43');
      box(group, [1.26, 0.14, 1.26], [0, 0.1, 0], '#8a5f30');
      box(group, [1.26, 0.14, 1.26], [0, 1.1, 0], '#8a5f30');
      height = 1.2;
      break;
    }
    case 'prop-lamp': {
      cyl(group, 0.12, 0.15, 4, [0, 2, 0], '#3a3f45', 8);
      box(group, [0.7, 0.18, 0.7], [0, 4.05, 0], '#3a3f45');
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8), new THREE.MeshStandardMaterial({ color: '#ffe6a8', emissive: '#ffca66', emissiveIntensity: 2 }));
      bulb.position.set(0, 3.85, 0);
      group.add(bulb);
      const light = new THREE.PointLight('#ffd28a', 8, 14, 2);
      light.position.set(0, 3.8, 0);
      group.add(light);
      height = 4.2;
      break;
    }
    case 'prop-sword': {
      box(group, [0.1, 1.8, 0.04], [0, 1.5, 0], '#c7d2df', [0, 0, 0], 0.25);
      box(group, [0.55, 0.1, 0.1], [0, 0.55, 0], '#8a6a32');
      box(group, [0.14, 0.5, 0.14], [0, 0.25, 0], '#5b3f26');
      height = 2.5;
      break;
    }
    default:
      return null;
  }
  group.userData.propId = id;
  return { group, height, focusY: height * 0.5 };
}
