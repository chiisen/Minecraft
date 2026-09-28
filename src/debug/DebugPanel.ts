import GUI from 'lil-gui';

/** 可由 Debug UI 調整的設定（PRD §14）。 */
export interface DebugSettings {
  antCount: number;
  flowerCount: number;
  instancing: boolean;
  lod: boolean;
  distanceCulling: boolean;
  shadows: boolean;
  wireframe: boolean;
}

export type SettingKey = keyof DebugSettings;

/** Performance 區塊的即時讀數。 */
export interface DebugReadout {
  fps: number;
  frameTime: number;
  triangles: number;
  drawCalls: number;
  objects: number;
  ants: number;
  note: string;
}

export class DebugPanel {
  readonly settings: DebugSettings;
  readonly readout: DebugReadout;

  private readonly gui: GUI;

  constructor(defaults: DebugSettings, onChange: (key: SettingKey) => void) {
    this.settings = { ...defaults };
    this.readout = {
      fps: 0,
      frameTime: 0,
      triangles: 0,
      drawCalls: 0,
      objects: 0,
      ants: 0,
      note: '',
    };

    this.gui = new GUI({ title: 'Multi-Scale Voxel' });
    this.buildSceneFolder(onChange);
    this.buildRenderingFolder(onChange);
    this.buildPerformanceFolder();
  }

  /** 顯示例如「Instancing OFF 已限制在 1,000 隻」的提示。 */
  setNote(text: string): void {
    this.readout.note = text;
    this.refreshDisplay();
  }

  refreshDisplay(): void {
    for (const controller of this.gui.controllersRecursive()) {
      controller.updateDisplay();
    }
  }

  private buildSceneFolder(onChange: (key: SettingKey) => void): void {
    const folder = this.gui.addFolder('Scene');

    folder
      .add(this.settings, 'antCount', 0, 10_000, 100)
      .name('Ant Count')
      .onChange(() => onChange('antCount'));

    folder
      .add(this.settings, 'flowerCount', 0, 200, 1)
      .name('Flower Count')
      .onChange(() => onChange('flowerCount'));

    const presets = {
      ants100: () => this.applyAntPreset(100, onChange),
      ants1000: () => this.applyAntPreset(1000, onChange),
      ants10000: () => this.applyAntPreset(10_000, onChange),
    };
    folder.add(presets, 'ants100').name('100 Ants');
    folder.add(presets, 'ants1000').name('1,000 Ants');
    folder.add(presets, 'ants10000').name('10,000 Ants');
  }

  private buildRenderingFolder(onChange: (key: SettingKey) => void): void {
    const folder = this.gui.addFolder('Rendering');

    folder.add(this.settings, 'instancing').name('Instancing').onChange(() => onChange('instancing'));
    folder.add(this.settings, 'lod').name('LOD').onChange(() => onChange('lod'));
    folder
      .add(this.settings, 'distanceCulling')
      .name('Distance Culling')
      .onChange(() => onChange('distanceCulling'));
    folder.add(this.settings, 'shadows').name('Shadows').onChange(() => onChange('shadows'));
    folder.add(this.settings, 'wireframe').name('Wireframe').onChange(() => onChange('wireframe'));
  }

  private buildPerformanceFolder(): void {
    const folder = this.gui.addFolder('Performance');
    folder.add(this.readout, 'fps').name('FPS').listen().disable();
    folder.add(this.readout, 'frameTime').name('Frame Time (ms)').listen().disable();
    folder.add(this.readout, 'triangles').name('Triangles').listen().disable();
    folder.add(this.readout, 'drawCalls').name('Draw Calls').listen().disable();
    folder.add(this.readout, 'objects').name('Objects').listen().disable();
    folder.add(this.readout, 'ants').name('Visible Ants').listen().disable();
    folder.add(this.readout, 'note').name('').listen().disable();
  }

  private applyAntPreset(count: number, onChange: (key: SettingKey) => void): void {
    this.settings.antCount = count;
    this.refreshDisplay();
    onChange('antCount');
  }
}
