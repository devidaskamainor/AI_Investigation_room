// Small test-only PNG; production uses generated clue-bearing images.
export const TEST_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR9sAAAAASUVORK5CYII=',
  'base64',
);
export class MemoryStorageProvider {
  constructor() {
    this.files = new Map();
  }
  async put(key, buffer) {
    this.files.set(key, buffer);
  }
  async get(key) {
    if (!this.files.has(key)) throw new Error('Missing test file');
    return this.files.get(key);
  }
  async exists(key) {
    return this.files.has(key);
  }
  async delete(key) {
    this.files.delete(key);
  }
}
export class MockImageProvider {
  async generate() {
    return { buffer: TEST_PNG, mimeType: 'image/png' };
  }
}
